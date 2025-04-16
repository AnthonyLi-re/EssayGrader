import { NextRequest, NextResponse } from "next/server";

// Define interfaces for structured feedback
interface ScoreDetails {
  overall: number;
  content: number;
  language: number;
  organization: number;
}

interface FeedbackItem {
  type: "Grammar" | "Spelling" | "Word Choice" | "Sentence Flow" | "Clarity" | "Style" | "Other";
  segment: string; // The exact text segment from the essay
  suggestion: string; // Explanation or suggested correction
  severity?: "High" | "Medium" | "Low"; // Optional severity indicator
}

interface StructuredFeedback {
  scores: ScoreDetails;
  feedbackItems: FeedbackItem[];
}

/**
 * Helper function to extract JSON from text that might contain Markdown code blocks
 * or other formatting artifacts
 */
function extractJsonFromText(text: string): any {
  console.log('Extracting JSON from:', text.substring(0, 200) + '...');
  
  // First try parsing the text directly as JSON (full API response)
  try {
    const fullJson = JSON.parse(text);
    
    // Check if this is an OpenRouter/Mistral response
    if (fullJson.choices && Array.isArray(fullJson.choices) && fullJson.choices.length > 0) {
      // Extract content from OpenRouter/Mistral format
      if (fullJson.choices[0].message && fullJson.choices[0].message.content) {
        console.log('Detected OpenRouter/Mistral API response structure');
        // Get the content and pass it for further extraction
        return extractJsonFromText(fullJson.choices[0].message.content);
      }
    }
    
    // If it has our expected structure, return it directly
    if (fullJson.scores && fullJson.feedbackItems) {
      console.log('Found valid structured feedback directly in response');
      return fullJson;
    }
    
    // For other API response formats, check for standard response objects
    if (fullJson.object === "chat.completion" || fullJson.object === "completion") {
      console.log('Detected standard API completion object');
      return extractJsonFromText(fullJson.choices[0].message.content);
    }
    
    // Return the parsed JSON for further processing
    return fullJson;
    
  } catch (error) {
    console.log('Could not parse entire text as JSON, trying other methods...');
    // Continue to other extraction methods if direct parsing fails
  }
  
  // Try to extract JSON from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const codeBlockMatch = text.match(codeBlockRegex);
  
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const jsonContent = codeBlockMatch[1].trim();
      console.log('Found code block, extracted content');
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing JSON from code block:', error);
      // Continue to next method if this fails
    }
  }
  
  // If no code block or parsing failed, try to find the first { and last } and parse that
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
      console.log('Extracted JSON using object boundaries');
      return JSON.parse(jsonSubstring);
    }
  } catch (nestedError) {
    console.error('Error extracting JSON with brace method:', nestedError);
  }
  
  throw new Error('Failed to extract valid JSON from text');
}

// Validate that the feedback structure contains the required fields
function validateFeedbackStructure(feedback: any): boolean {
  // Check if we received a parsed object
  if (typeof feedback !== 'object' || feedback === null) {
    console.error('Feedback is not an object:', feedback);
    return false;
  }

  // Check if it matches our expected structure
  if (feedback.scores && feedback.feedbackItems && Array.isArray(feedback.feedbackItems)) {
    return true;
  }
  
  // Check for old/alternative format with individual score fields
  const requiredFields = ['overall_score', 'clarity_score', 'coherence_score', 'relevance_score', 'feedback_items'];
  const missingFields = requiredFields.filter(field => !(field in feedback));
  
  if (missingFields.length > 0) {
    console.error('Feedback missing required fields:', missingFields);
    return false;
  }
  
  // Check if feedback_items is an array
  if (!Array.isArray(feedback.feedback_items)) {
    console.error('feedback_items is not an array');
    return false;
  }
  
  // All validations passed
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication using JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.split(" ")[1];
    
    try {
      // Parse the token
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub || payload.id;
      
      if (!userId) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }

      // Get data from request
      const data = await req.json();
      const { question, content } = data;
      
      if (!question || !content) {
        return NextResponse.json(
          { error: "Question and essay content are required" },
          { status: 400 }
        );
      }

      console.log("Processing essay with Mistral AI for structured feedback...");
      
      // Define system prompt for essay grading
      const systemPrompt = `You are an expert HKDSE English Language Paper 2 (Writing) examiner with 15+ years of experience.
Analyze student essays according to HKDSE criteria, providing detailed, constructive feedback.

Assess essays based on:
1. Content (max 7 points): relevance to topic, idea development, supporting details
2. Language (max 7 points): grammar, vocabulary range, spelling/punctuation
3. Organization (max 7 points): coherence, paragraph structure, transitions

Your feedback must include:
1. Numerical scores for each category (0-7)
2. Specific feedback items highlighting both strengths and weaknesses
3. Practical suggestions for improvement

Return your assessment in the following JSON structure:
{
  "scores": {
    "content": <0-7>,
    "language": <0-7>,
    "organization": <0-7>,
    "overall": <sum of above, 0-21>
  },
  "feedbackItems": [
    {
      "type": "<category - Grammar|Spelling|Word Choice|Sentence Flow|Clarity|Style|Content Requirement|Relevance|Idea Development|Organization>",
      "segment": "<specific text from essay>",
      "suggestion": "<detailed feedback with improvement suggestion>"
    },
    ...more items (8-12 total, mix of strengths and weaknesses)
  ]
}`;
      
      // User prompt containing the essay and instructions
      const userPrompt = `Evaluate this essay according to HKDSE English Language Paper 2 (Writing) criteria.

PROMPT/QUESTION: ${question}

ESSAY:
${content}

Provide a thorough assessment with:
1. Numerical scores (0-7) for Content, Language, and Organization
2. 8-12 specific feedback points referencing actual text from the essay
3. A mix of strengths and weaknesses with practical improvement suggestions

IMPORTANT: Respond ONLY with valid JSON matching the specified structure.`;
      
      // Initialize OpenRouter client for Mistral
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        throw new Error("OPENROUTER_API_KEY is not configured");
      }

      // Call OpenRouter API with Mistral model
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Essay Grading Platform'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-small-3.1-24b-instruct:free',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          data_policies: {
            allow_prompt_training: true,
            allow_sharing: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response text from OpenRouter/Mistral:', errorData);
        try {
          const errorJson = JSON.parse(errorData);
          console.error('Parsed error JSON from OpenRouter/Mistral:', errorJson);
          
          // Check for various error types
          if (response.status === 429 || (errorJson.error?.message && errorJson.error.message.includes("rate"))) {
            return NextResponse.json(
              { error: "Rate limit reached for Mistral AI. Please try again in a few minutes." },
              { status: 429 }
            );
          }
          
          if (errorJson.error?.message && errorJson.error.message.includes("model")) {
            return NextResponse.json(
              { error: `Model error: ${errorJson.error.message}. Using mistral-medium-latest model.` },
              { status: 400 }
            );
          }

          if (errorJson.error?.message && errorJson.error.message.includes("key")) {
            return NextResponse.json(
              { error: "API key error: Make sure the OPENROUTER_API_KEY is valid." },
              { status: 401 }
            );
          }
          
          throw new Error(`Mistral API error: ${errorJson.error?.message || response.statusText}`);
        } catch (parseError) {
          throw new Error(`Mistral API error: ${response.statusText}. Could not parse error response.`);
        }
      }

      const responseText = await response.text();
      console.log("Raw API response received - length:", responseText.length);
      
      // Extract JSON from the response text (handling code blocks, nested structures, etc.)
      let extractedJson;
      try {
        extractedJson = extractJsonFromText(responseText);
        console.log("Successfully extracted JSON from response");
      } catch (error) {
        console.error("Failed to extract JSON from response:", error);
        // Create a minimal fallback to avoid further errors
        extractedJson = { 
          scores: { overall: 70, content: 70, language: 70, organization: 70 },
          feedbackItems: [],
          error: "Failed to extract valid JSON from AI response"
        };
      }
      
      let structuredFeedback: StructuredFeedback;
      try {
        // Check if we need to transform the format (from older API format)
        if (extractedJson.scores && extractedJson.feedbackItems) {
          // Already in our expected format
          structuredFeedback = extractedJson as StructuredFeedback;
          
          // Convert scores from 0-7 scale to 0-100 if they appear to be on the 0-7 scale
          if (structuredFeedback.scores.content <= 7 && 
              structuredFeedback.scores.language <= 7 && 
              structuredFeedback.scores.organization <= 7) {
            console.log("Converting scores from 0-7 scale to 0-100 scale");
            structuredFeedback.scores.content = Math.round(structuredFeedback.scores.content * (100/7));
            structuredFeedback.scores.language = Math.round(structuredFeedback.scores.language * (100/7));
            structuredFeedback.scores.organization = Math.round(structuredFeedback.scores.organization * (100/7));
            structuredFeedback.scores.overall = Math.round((structuredFeedback.scores.content + 
                                                         structuredFeedback.scores.language + 
                                                         structuredFeedback.scores.organization) / 3);
          }
        } 
        // Check for alternative format
        else if (extractedJson.overall_score !== undefined) {
          // Transform from alternative format to our expected format
          structuredFeedback = {
            scores: {
              overall: extractedJson.overall_score,
              content: extractedJson.relevance_score || 70,
              language: extractedJson.clarity_score || 70,
              organization: extractedJson.coherence_score || 70
            },
            feedbackItems: extractedJson.feedback_items?.map((item: any) => ({
              type: item.type === "strength" || item.type === "weakness" ? "Other" : item.type,
              segment: item.point || "",
              suggestion: item.explanation || ""
            })) || []
          };
        } else {
          // Use extracted JSON as is but verify structure
          structuredFeedback = extractedJson as StructuredFeedback;
        }
        
        // Validate the basic structure
        if (!structuredFeedback.scores || !structuredFeedback.feedbackItems) {
          throw new Error("Invalid JSON structure - missing scores or feedbackItems");
        }
        
        console.log("Structured feedback processed successfully");
        console.log(`Received ${structuredFeedback.feedbackItems.length} feedback items`);
        
        // Filter out any feedback items with empty or extremely long segments
        structuredFeedback.feedbackItems = structuredFeedback.feedbackItems.filter(item => {
          return item.segment && typeof item.segment === 'string' && 
                 item.segment.trim().length > 0 && 
                 item.segment.length < 200; // Practical limit for highlighting
        });
        
        console.log(`After filtering, ${structuredFeedback.feedbackItems.length} valid feedback items remain`);
        
        // Ensure all feedback items have the required fields
        structuredFeedback.feedbackItems.forEach(item => {
          // Default to "Other" if type is invalid
          if (!["Grammar", "Spelling", "Word Choice", "Sentence Flow", "Clarity", "Style", "Other"].includes(item.type)) {
            item.type = "Other";
          }
        });
        
      } catch (error) {
        console.error("Error processing AI response:", error);
        
        // Create a fallback structured response
        structuredFeedback = {
          scores: { overall: 70, content: 70, language: 70, organization: 70 }, // Default scores
          feedbackItems: []
        };
        
        // Try to parse scores from the text using regex if possible
        const overallMatch = responseText.match(/\"overall\":\s*(\d+)/);
        const contentMatch = responseText.match(/\"content\":\s*(\d+)/);
        const languageMatch = responseText.match(/\"language\":\s*(\d+)/);
        const organizationMatch = responseText.match(/\"organization\":\s*(\d+)/);
        
        if (overallMatch) {
          const overall = parseInt(overallMatch[1]);
          // Convert from 0-21 scale if needed
          structuredFeedback.scores.overall = overall <= 21 ? Math.round(overall * (100/21)) : overall;
        }
        if (contentMatch) {
          const content = parseInt(contentMatch[1]);
          // Convert from 0-7 scale if needed
          structuredFeedback.scores.content = content <= 7 ? Math.round(content * (100/7)) : content;
        }
        if (languageMatch) {
          const language = parseInt(languageMatch[1]);
          // Convert from 0-7 scale if needed
          structuredFeedback.scores.language = language <= 7 ? Math.round(language * (100/7)) : language;
        }
        if (organizationMatch) {
          const organization = parseInt(organizationMatch[1]);
          // Convert from 0-7 scale if needed
          structuredFeedback.scores.organization = organization <= 7 ? Math.round(organization * (100/7)) : organization;
        }
        
        // Return the fallback with an error indication
        return NextResponse.json({
          ...structuredFeedback,
          error: "Failed to process AI feedback into proper structure.",
          rawResponse: process.env.NODE_ENV === 'development' ? responseText.substring(0, 500) : undefined
        });
      }
        
      return NextResponse.json(structuredFeedback);
        
    } catch (error) {
      console.error("Error parsing token or processing with Mistral:", error);
      return NextResponse.json(
        { error: "Failed to process essay with AI" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in Mistral processing:", error);
    return NextResponse.json(
      { error: "Failed to process essay" },
      { status: 500 }
    );
  }
} 