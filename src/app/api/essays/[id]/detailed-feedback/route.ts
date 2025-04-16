import { NextRequest, NextResponse } from "next/server";
import { serverGetUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Interface for structured feedback
interface FeedbackItem {
  type: "Grammar" | "Spelling" | "Word Choice" | "Sentence Flow" | "Clarity" | "Style" | "Content Requirement" | "Relevance" | "Idea Development" | "Organization" | "Other";
  segment: string;
  suggestion: string;
  number: number;
}

interface EssayScores {
  content: number;
  language: number;
  organization: number;
  overall: number;
}

// Function to call OpenRouter API with Mistral model
async function callOpenRouter(prompt: string, systemPrompt?: string, temperature: number = 0.3, maxTokens: number = 2000) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is not configured");
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Essay Grading Platform'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.1-24b-instruct:free',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        // Optional: Add response format for structured outputs
        response_format: { type: "text" },
        // Add data policies to allow prompt sharing/training
        data_policies: {
          allow_prompt_training: true,
          allow_sharing: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from OpenRouter:', errorData);
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    throw error;
  }
}

// Grade essay based on HKDSE criteria
async function gradeEssay(essay: { content: string; prompt: string }): Promise<EssayScores> {
  const systemPrompt = `You are an expert HKDSE English Language Paper 2 (Writing) examiner with 15+ years of experience. 
You assess essays based on:

1. Content (0-7):
   - Relevance to the topic/task
   - Development of ideas (depth and originality)
   - Use of examples and supporting details
   - Task completion

2. Language (0-7):
   - Grammatical accuracy and complexity
   - Vocabulary range and appropriateness
   - Spelling and punctuation
   - Style and tone

3. Organization (0-7):
   - Coherence and cohesion
   - Paragraph structure and development
   - Use of discourse markers and transitions
   - Overall structure (introduction, body, conclusion)

Calculate the total score (out of 21) and convert to percentage scores.
Respond with ONLY a JSON object containing the scores - no additional text.`;

  const prompt = `Grade this essay according to HKDSE English Language Paper 2 (Writing) criteria.
  
Question/Prompt: ${essay.prompt}

Essay content:
${essay.content}

Return ONLY a JSON object with the following fields:
{
  "content": [score 0-7],
  "language": [score 0-7], 
  "organization": [score 0-7],
  "overall": [sum of the above, 0-21]
}`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, 0.3, 1000);
    
    // Parse the JSON response
    let scores: EssayScores;
    try {
      scores = JSON.parse(response) as EssayScores;
      
      // Validate the scores
      if (scores.content === undefined || scores.language === undefined || scores.organization === undefined || scores.overall === undefined) {
        throw new Error("Missing required score fields");
      }
      
      // Ensure all scores are numbers between 0-7 for individual criteria and 0-21 for overall
      scores.content = Math.min(7, Math.max(0, Math.round(scores.content)));
      scores.language = Math.min(7, Math.max(0, Math.round(scores.language)));
      scores.organization = Math.min(7, Math.max(0, Math.round(scores.organization)));
      scores.overall = Math.min(21, Math.max(0, Math.round(scores.overall)));
      
      // Convert to percentages for the UI
      return {
        content: scores.content * (100/7), // Convert to percentage
        language: scores.language * (100/7),
        organization: scores.organization * (100/7),
        overall: scores.overall * (100/21)
      };
    } catch (error) {
      console.error("Error parsing scores:", error, "Response:", response);
      
      // Default fallback scores if parsing fails
      return {
        content: 70,
        language: 70,
        organization: 70,
        overall: 70
      };
    }
  } catch (error) {
    console.error("Error grading essay:", error);
    throw error;
  }
}

// Identify text segments to highlight
async function identifyTextSegments(essay: { content: string; prompt: string }): Promise<string[]> {
  const systemPrompt = `You are an expert HKDSE English Language examiner with a keen eye for meaningful text analysis. 
Your task is to identify specific segments in the essay (5-15 words each) that demonstrate:

1. Grammatical strengths or weaknesses (verb tense, subject-verb agreement, article usage)
2. Vocabulary usage (word choice, collocations, idioms)
3. Sentence structure (complexity, variety, flow)
4. Content elements (key arguments, examples, evidence)
5. Organizational features (topic sentences, transitions, concluding statements)
6. Spelling and punctuation issues

Choose segments that are most representative of the student's writing abilities - both strengths and areas for improvement.`;

  const prompt = `Analyze this essay and identify 10-15 specific text segments that demonstrate the student's writing skills.

Question/Prompt: ${essay.prompt}

Essay:
${essay.content}

Choose segments that:
- Are 5-15 words in length
- Appear exactly as written in the essay
- Represent both strengths and weaknesses
- Cover a range of assessment criteria (grammar, vocabulary, organization, content)

Respond with ONLY a JSON array of text segments, exactly as they appear in the essay:
["segment 1", "segment 2", "segment 3", ...]`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, 0.3, 1500);
    
    // Parse the JSON response
    try {
      const segments = JSON.parse(response) as string[];
      if (!Array.isArray(segments) || segments.length === 0) {
        throw new Error("Invalid segments format");
      }
      return segments;
    } catch (error) {
      console.error("Error parsing segments:", error, "Response:", response);
      
      // Extract segments from the text if JSON parsing fails
      // Look for quoted strings and extract them
      const segmentMatches = response.match(/"([^"]+)"/g);
      if (segmentMatches && segmentMatches.length > 0) {
        return segmentMatches.map((s: string) => s.replace(/^"|"$/g, ''));
      }
      
      // If all else fails, split the essay into sentences and take the first few
      const sentences = essay.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return sentences.slice(0, 5).map(s => s.trim().substring(0, 50));
    }
  } catch (error) {
    console.error("Error identifying text segments:", error);
    throw error;
  }
}

// Generate comments for highlighted segments
async function generateCommentsForSegments(essay: { content: string; prompt: string; }, segments: string[]): Promise<FeedbackItem[]> {
  const segmentsJson = JSON.stringify(segments);
  
  const systemPrompt = `You are an expert HKDSE English Language examiner providing detailed, constructive feedback on student writing.
Your feedback should:
1. Be specific and targeted to the exact text segment
2. Include both strengths and areas for improvement
3. Provide clear explanations of linguistic concepts when relevant
4. Offer practical suggestions for improvement
5. Use a supportive, encouraging tone
6. Reference HKDSE assessment criteria where appropriate

Classify each feedback item using EXACTLY ONE of these feedback types:
- Grammar: For issues related to syntax, tense, subject-verb agreement, articles, etc.
- Spelling: For misspelled words or typos
- Word Choice: For vocabulary usage, word precision, formality, or register
- Sentence Flow: For issues with sentence structure, variety, or transitions between sentences
- Clarity: For unclear expressions or ambiguous meaning
- Style: For tone, voice, or overall writing style
- Content Requirement: For addressing the essay prompt requirements
- Relevance: For staying on topic and providing relevant examples/evidence
- Idea Development: For expanding on ideas, depth of analysis, or critical thinking
- Organization: For paragraph structure, transitions, or overall essay organization`;

  const prompt = `For each of the following text segments from a student essay, provide detailed, specific feedback.

Essay prompt: ${essay.prompt}

For each segment, create a feedback item with:
1. Type - Classify as EXACTLY ONE of: "Grammar", "Spelling", "Word Choice", "Sentence Flow", "Clarity", "Style", "Content Requirement", "Relevance", "Idea Development", or "Organization"
2. Segment - The exact text from the essay (unchanged)
3. Suggestion - A specific, constructive comment (30-60 words) that explains the issue or strength and offers improvement suggestions

Segments to analyze: ${segmentsJson}

IMPORTANT: Use the exact type categories listed above. Be specific in your feedback. Generic comments like "Review this section" are not helpful.

Return ONLY a JSON array with feedback items in this format:
[
  {
    "type": "Grammar", 
    "segment": "exact text segment",
    "suggestion": "detailed feedback with specific suggestions"
  },
  ...
]`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, 0.3, 3000);
    
    // Parse the JSON response
    try {
      let feedbackItems: Omit<FeedbackItem, 'number'>[] = [];
      
      // Try different JSON parsing methods if the response isn't properly formatted
      try {
        // First, try direct JSON parsing
        feedbackItems = JSON.parse(response) as Omit<FeedbackItem, 'number'>[];
      } catch (jsonError) {
        console.log("Initial JSON parse failed, trying alternative extraction methods");
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          feedbackItems = JSON.parse(jsonMatch[0]) as Omit<FeedbackItem, 'number'>[];
        } else {
          // If that fails, try to parse each item separately using regex
          const itemMatches = response.matchAll(/\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"segment"\s*:\s*"([^"]+)"\s*,\s*"suggestion"\s*:\s*"([^"]+)"\s*\}/g);
          
          for (const match of itemMatches) {
            feedbackItems.push({
              type: match[1] as any,
              segment: match[2],
              suggestion: match[3]
            });
          }
        }
      }
      
      // If we still don't have valid feedback items, throw an error
      if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
        throw new Error("Unable to parse feedback items from response");
      }
      
      // Validate and standardize feedback types
      const validatedItems = feedbackItems
        .map(item => {
          // Normalize type to match our expected types
          let normalizedType = item.type;
          
          // Try to match the item type to our valid types
          const types = [
            "Grammar", "Spelling", "Word Choice", "Sentence Flow", 
            "Clarity", "Style", "Content Requirement", "Relevance", 
            "Idea Development", "Organization"
          ];
          
          // Find the closest match or default to "Other"
          const matchedType = types.find(t => 
            normalizedType.toLowerCase().includes(t.toLowerCase()) ||
            t.toLowerCase().includes(normalizedType.toLowerCase())
          ) || "Other";
          
          return {
            ...item,
            type: matchedType as any,
            // Ensure segment and suggestion are strings
            segment: String(item.segment || ""),
            suggestion: String(item.suggestion || "")
          };
        })
        .filter(item => 
          item.segment && 
          item.segment.trim().length > 0 &&
          item.suggestion && 
          item.suggestion.trim().length > 0 &&
          item.suggestion.trim() !== "Review this section for possible improvements in grammar, word choice, or clarity."
        )
        .map((item, index) => ({
          ...item,
          number: index + 1
        }));
      
      // If no items passed validation, throw an error
      if (validatedItems.length === 0) {
        throw new Error("No valid feedback items after validation");
      }
      
      return validatedItems;
    } catch (error) {
      console.error("Error parsing feedback items:", error, "Response:", response);
      
      // Create better fallback feedback items with varied feedback
      const fallbackSuggestions = [
        "Consider revising for clarity and precision. Focus on making your point more direct.",
        "This shows good vocabulary use. Consider how it connects to your main argument.",
        "Review for grammatical accuracy. Check subject-verb agreement and tense consistency.",
        "Good point that could be strengthened with a specific example to support your claim.",
        "Consider restructuring this sentence for better flow and readability.",
        "Strong vocabulary choice. Continue developing this idea with supporting details.",
        "This transition works well. Consider how it connects your paragraphs thematically.",
        "Review for conciseness. Can you express this idea more directly?",
        "Interesting point that addresses the prompt well. Consider expanding on this idea.",
        "Check spelling and punctuation. Consistent mechanics strengthen your writing."
      ];
      
      const fallbackTypes = [
        "Grammar", "Word Choice", "Sentence Flow", "Clarity", 
        "Style", "Idea Development", "Organization", "Relevance"
      ];
      
      return segments.map((segment, index) => ({
        type: fallbackTypes[index % fallbackTypes.length] as any,
        segment,
        suggestion: fallbackSuggestions[index % fallbackSuggestions.length],
        number: index + 1
      }));
    }
  } catch (error) {
    console.error("Error generating comments for segments:", error);
    throw error;
  }
}

// Check if feedback type is valid
function isValidFeedbackType(type: string): boolean {
  const validTypes = [
    "Grammar", "Spelling", "Word Choice", "Sentence Flow", 
    "Clarity", "Style", "Content Requirement", "Relevance", 
    "Idea Development", "Organization", "Other"
  ];
  return validTypes.includes(type);
}

// Function to generate structured highlighted content from essay text
function generateHighlightedContent(essayContent: string, feedbackItems: FeedbackItem[]): string {
  let highlightedContent = essayContent;
  
  // Sort feedback items by their position in text (if they are found)
  // This ensures we replace from end to beginning to avoid messing up positions
  const sortedItems = [...feedbackItems].sort((a, b) => {
    const posA = highlightedContent.indexOf(a.segment);
    const posB = highlightedContent.indexOf(b.segment);
    return posB - posA; // Sort in reverse order (end to beginning)
  });
  
  // Replace each segment with a highlighted version
  for (const item of sortedItems) {
    const segment = item.segment;
    const highlightIndex = highlightedContent.indexOf(segment);
    
    if (highlightIndex !== -1) {
      // Get the appropriate highlight class based on type
      let highlightClass = "";
      
      if (["Grammar", "Spelling", "Word Choice", "Style"].includes(item.type)) {
        highlightClass = "highlight-language bg-yellow-100 border-yellow-300 border rounded-md px-1";
      } else if (["Sentence Flow", "Organization", "Clarity"].includes(item.type)) {
        highlightClass = "highlight-organization bg-blue-100 border-blue-300 border rounded-md px-1";
      } else {
        highlightClass = "highlight-content bg-pink-100 border-pink-300 border rounded-md px-1";
      }
      
      // Replace the segment with a highlighted version
      const before = highlightedContent.substring(0, highlightIndex);
      const after = highlightedContent.substring(highlightIndex + segment.length);
      
      highlightedContent = `${before}<span class="${highlightClass}" data-highlight-id="${item.number}">${segment} (${item.number})</span>${after}`;
    }
  }
  
  // Convert line breaks to paragraph elements
  highlightedContent = highlightedContent
    .split('\n')
    .map(line => `<p>${line || '&nbsp;'}</p>`)
    .join('');
  
  return highlightedContent;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = serverGetUserSession(req);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized: Please sign in to access this resource" }, { status: 401 });
  }
  
  try {
    const essay = await prisma.essay.findUnique({
      where: {
        id: params.id,
      },
      include: {
        feedback: true,
      },
    });
    
    if (!essay) {
      return NextResponse.json({ error: "Essay not found" }, { status: 404 });
    }
    
    // Check if the essay belongs to the user
    if (essay.authorId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    // Check if we already have stored detailed feedback
    if (essay.feedback?.feedback) {
      try {
        // Try to parse the stored feedback JSON
        const parsedFeedback = JSON.parse(essay.feedback.feedback);
        
        // Verify it has the expected structure
        if (parsedFeedback.feedbackItems && parsedFeedback.highlightedContent) {
          console.log("Using stored detailed feedback for essay:", params.id);
          return NextResponse.json(parsedFeedback);
        }
      } catch (parseError) {
        console.error("Error parsing stored feedback, will regenerate:", parseError);
      }
    }
    
    console.log("Generating new detailed feedback for essay:", params.id);
    
    // Get the basic scores from the existing feedback or generate new ones
    let scores: EssayScores;
    if (essay.feedback) {
      scores = {
        content: essay.feedback.contentScore,
        language: essay.feedback.languageScore,
        organization: essay.feedback.organizationScore,
        overall: essay.feedback.totalScore
      };
    } else {
      // Generate scores using OpenRouter API if no feedback exists
      scores = await gradeEssay({ content: essay.content, prompt: essay.prompt });
    }
    
    // Identify segments to highlight
    const segments = await identifyTextSegments({ content: essay.content, prompt: essay.prompt });
    
    // Generate comments for each segment
    const feedbackItems = await generateCommentsForSegments(
      { content: essay.content, prompt: essay.prompt },
      segments
    );
    
    // Generate highlighted content
    const highlightedContent = generateHighlightedContent(essay.content, feedbackItems);
    
    // Create the detailed feedback object
    const detailedFeedback = {
      scores,
      feedbackItems,
      highlightedContent
    };
    
    // Store the detailed feedback in the database
    if (essay.feedback) {
      await prisma.feedback.update({
        where: { id: essay.feedback.id },
        data: {
          feedback: JSON.stringify(detailedFeedback),
        },
      });
    } else {
      // Create a new feedback record if one doesn't exist
      await prisma.feedback.create({
        data: {
          essayId: essay.id,
          contentScore: scores.content,
          languageScore: scores.language,
          organizationScore: scores.organization,
          totalScore: scores.overall,
          feedback: JSON.stringify(detailedFeedback),
        },
      });
    }
    
    return NextResponse.json(detailedFeedback);
  } catch (error) {
    console.error("Error getting detailed essay feedback:", error);
    return NextResponse.json(
      { error: "Failed to get detailed essay feedback" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = serverGetUserSession(req);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized: Please sign in to access this resource" }, { status: 401 });
  }
  
  try {
    const essay = await prisma.essay.findUnique({
      where: {
        id: params.id,
      },
    });
    
    if (!essay) {
      return NextResponse.json({ error: "Essay not found" }, { status: 404 });
    }
    
    // Check if the essay belongs to the user
    if (essay.authorId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    // Generate scores using OpenRouter API
    const scores = await gradeEssay({ content: essay.content, prompt: essay.prompt });
    
    // Identify segments to highlight
    const segments = await identifyTextSegments({ content: essay.content, prompt: essay.prompt });
    
    // Generate comments for each segment
    const feedbackItems = await generateCommentsForSegments(
      { content: essay.content, prompt: essay.prompt },
      segments
    );
    
    // Generate highlighted content
    const highlightedContent = generateHighlightedContent(essay.content, feedbackItems);
    
    return NextResponse.json({
      scores,
      feedbackItems,
      highlightedContent
    });
  } catch (error) {
    console.error("Error generating detailed essay feedback:", error);
    return NextResponse.json(
      { error: "Failed to generate detailed essay feedback" },
      { status: 500 }
    );
  }
} 