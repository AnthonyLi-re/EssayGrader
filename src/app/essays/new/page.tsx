"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, FileText, Loader2, Upload, Check, X, ChevronRight, ChevronLeft, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateFileForOCR, compressFileForOCR } from "@/lib/pdf-utils";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { ensureAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

type EssayFile = {
  id: string;
  file: File;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  feedback?: string;
  scores?: {
    overall: number;
    content: number;
    language: number;
    organization: number;
  };
  preview?: boolean;
};

export default function NewEssay() {
  const [question, setQuestion] = useState("");
  const [content, setContent] = useState("");
  const [essays, setEssays] = useState<EssayFile[]>([]);
  const [activeEssayIndex, setActiveEssayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [extractingText, setExtractingText] = useState(false);
  const [extractingFor, setExtractingFor] = useState<'question' | 'content' | null>(null);
  const [processingMessage, setProcessingMessage] = useState("Extracting text...");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeTab, setActiveTab] = useState("upload");
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [lastSubmittedEssayId, setLastSubmittedEssayId] = useState<string | null>(null);
  const [previewEssay, setPreviewEssay] = useState<EssayFile | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const processingMessages = [
    "Scanning document...", "Converting image to text...", "Reading text from document...",
    "Analyzing document structure...", "Cleaning up OCR artifacts...", "Reconstructing paragraphs...",
    "Enhancing text with AI...", "Almost there...", "Putting it all together..."
  ];

  useEffect(() => {
    if (!extractingText) return;
    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % processingMessages.length;
      setProcessingMessage(processingMessages[messageIndex]);
    }, 3000);
    return () => clearInterval(interval);
  }, [extractingText, processingMessages]);

  const handleQuestionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setError("You must be logged in to process files.");
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in." });
      router.push("/auth/signin");
      return;
    }
    if (!ensureAuth()) {
      console.error("Auth token missing or invalid.");
      setError("Authentication failed. Please sign in again.");
      return;
    }

    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateFileForOCR(selectedFile);
    if (!validation.valid) {
      setError(validation.message);
      toast({ variant: "destructive", title: "Invalid File", description: validation.message });
      return;
    }

    setQuestionFile(selectedFile);
    setError("");

    toast({ title: "File selected", description: `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` });
    processQuestionFile(selectedFile);
  };

  const processQuestionFile = async (selectedFile: File) => {
    setExtractingFor('question');
    setExtractingText(true);
    setProcessingMessage(processingMessages[0]);
    setProcessingProgress(0);
    
    try {
      const fileToUpload = await compressFileForOCR(selectedFile);
      if (fileToUpload !== selectedFile) {
        toast({ title: "File compressed", description: `Reduced from ${Math.round(selectedFile.size / 1024)} KB to ${Math.round(fileToUpload.size / 1024)} KB` });
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('languages', 'en');
      formData.append('cleanWithLLM', 'true');
      formData.append('textType', 'question');

      setProcessingMessage("Processing document with Google Cloud Vision...");
      const response = await fetch('/api/test-ocr', { method: 'POST', body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.text) throw new Error("No text was extracted.");

      setQuestion(data.text);
      setProcessingProgress(100);
      toast({ title: "Text extracted successfully", description: `Extracted ${data.text.length} characters.` });

    } catch (err: any) {
      console.error("OCR error:", err);
      const errorMessage = err.message || "Failed to process the file.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "OCR Processing Failed", description: errorMessage });
    } finally {
      setExtractingText(false);
      setExtractingFor(null);
    }
  };

  const handleEssayFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setError("You must be logged in to process files.");
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in." });
      router.push("/auth/signin");
      return;
    }
    if (!ensureAuth()) {
      console.error("Auth token missing or invalid.");
      setError("Authentication failed. Please sign in again.");
      return;
    }

    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newEssayFiles: EssayFile[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const validation = validateFileForOCR(file);
      
      if (!validation.valid) {
        toast({
          variant: "destructive", 
          title: `Invalid File: ${file.name}`, 
          description: validation.message 
        });
        continue;
      }
      
      newEssayFiles.push({
        id: `essay-${Date.now()}-${i}`,
        file,
        content: "",
        status: 'pending'
      });
    }

    if (newEssayFiles.length > 0) {
      setEssays(prev => [...prev, ...newEssayFiles]);
      toast({ 
        title: "Files selected", 
        description: `${newEssayFiles.length} files added for processing` 
      });
      
      // Process each file sequentially
      for (const essayFile of newEssayFiles) {
        await processEssayFile(essayFile.id, essayFile.file);
      }
    }
  };

  const processEssayFile = async (essayId: string, selectedFile: File) => {
    setExtractingFor('content');
    setExtractingText(true);
    setProcessingMessage(processingMessages[0]);
    setProcessingProgress(0);

    // Update status for this file
    setEssays(prev => prev.map(essay => 
      essay.id === essayId ? { ...essay, status: 'processing' } : essay
    ));

    try {
      const fileToUpload = await compressFileForOCR(selectedFile);
      if (fileToUpload !== selectedFile) {
        toast({ title: "File compressed", description: `Reduced from ${Math.round(selectedFile.size / 1024)} KB to ${Math.round(fileToUpload.size / 1024)} KB` });
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('languages', 'en');
      formData.append('cleanWithLLM', 'true');
      formData.append('textType', 'essay');

      setProcessingMessage("Processing document with Google Cloud Vision...");
      const response = await fetch('/api/test-ocr', { method: 'POST', body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.text) throw new Error("No text was extracted.");

      // Update essay with extracted content
      setEssays(prev => prev.map(essay => 
        essay.id === essayId ? { ...essay, content: data.text, status: 'completed' } : essay
      ));
      
      setProcessingProgress(100);
      toast({ title: `Text extracted: ${selectedFile.name}`, description: `Extracted ${data.text.length} characters.` });

    } catch (err: any) {
      console.error("OCR error:", err);
      const errorMessage = err.message || "Failed to process the file.";
      
      // Update essay with error
      setEssays(prev => prev.map(essay => 
        essay.id === essayId ? { ...essay, status: 'error', error: errorMessage } : essay
      ));
      
      toast({ variant: "destructive", title: `OCR Failed: ${selectedFile.name}`, description: errorMessage });
    } finally {
      // Continue to the next file if there are more
      setExtractingText(false);
      setExtractingFor(null);
    }
  };

  const removeEssay = (essayId: string) => {
    setEssays(prev => prev.filter(essay => essay.id !== essayId));
    toast({ title: "Essay removed", description: "The essay was removed from the queue." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setAiProcessing(true);
    setCompletedCount(0);

    if (!question) {
      setError("Essay question is required.");
      setLoading(false);
      setAiProcessing(false);
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide the essay question." });
      return;
    }

    // Check if we have either typed content or uploaded essays
    const hasTypedContent = content.trim() !== "";
    const hasUploadedEssays = essays.length > 0 && essays.some(essay => essay.status === 'completed' && essay.content.trim() !== "");

    if (!hasTypedContent && !hasUploadedEssays) {
      setError("No essays have been provided.");
      setLoading(false);
      setAiProcessing(false);
      toast({ variant: "destructive", title: "No Essays", description: "Please either type an essay or upload at least one essay file." });
      return;
    }

    try {
      // First, process any typed content if it exists
      if (hasTypedContent) {
        setProcessingMessage(`Analyzing typed essay with Mistral AI...`);
        
        // Create a file object for the typed content
        const typedFile = new File([content], `typed-essay-${Date.now()}.txt`, { type: 'text/plain' });
        const typedEssayId = `essay-typed-${Date.now()}`;
        
        // Add the typed essay to the essays array if it's not already there
        const typedEssayExists = essays.some(e => e.content === content);
        if (!typedEssayExists) {
          setEssays(prev => [...prev, {
            id: typedEssayId,
            file: typedFile,
            content: content,
            status: 'completed'
          }]);
        }
        
        // Process the typed essay with AI
        await processEssayWithAI(typedEssayId, content);
      }
      
      // Then process any uploaded essays
      const completedEssays = essays.filter(essay => essay.status === 'completed' && essay.content.trim() !== "");
      
      if (completedEssays.length > 0) {
        for (let i = 0; i < completedEssays.length; i++) {
          const essay = completedEssays[i];
          // Skip if this is the typed essay we just processed
          if (hasTypedContent && essay.content === content) continue;
          
          setProcessingMessage(`Analyzing essay ${i + 1}/${completedEssays.length} with Mistral AI...`);
          await processEssayWithAI(essay.id, essay.content);
        }
      }
      
      toast({
        title: "All Essays Analyzed", 
        description: `Processed ${completedCount} essays successfully.` 
      });

      // Redirect to the specific essay's feedback/results page if we have an ID
      if (lastSubmittedEssayId) {
        router.push(`/essays/${lastSubmittedEssayId}/results`);
      } else {
        router.push("/essays");
      }
      
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
      setAiProcessing(false);
    }
  };

  const processEssayWithAI = async (essayId: string, content: string) => {
    try {
      setProcessingMessage("Analyzing essay with Mistral AI...");
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`
        },
        body: JSON.stringify({
          question: question,
          content: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from AI analysis" }));
        
        // Specific handling for rate limit error
        if (response.status === 429 || errorData.error?.includes("rate limit")) {
          throw new Error("Mistral AI rate limit reached. Please try again in a few minutes.");
        }
        
        throw new Error(errorData.error || `AI processing failed: ${response.status}`);
      }

      const aiResponse = await response.json(); // Expecting StructuredFeedback or error indicator
      
      // Update the essay with feedback and scores
      setEssays(prev => prev.map(essay => 
        essay.id === essayId ? { 
          ...essay, 
          feedback: aiResponse.feedback,
          scores: aiResponse.scores
        } : essay
      ));

      // Save the essay to the database
      const essayToSave = essays.find(e => e.id === essayId);
      if (essayToSave) {
        const formData = new FormData();
        formData.append("title", `${question.split("\n")[0] || question} - ${essayToSave.file.name}`);
        formData.append("prompt", question);
        formData.append("content", content);
        formData.append("pdfFile", essayToSave.file);
        formData.append("feedback", aiResponse.feedback);
        formData.append("contentScore", aiResponse.scores.content.toString());
        formData.append("languageScore", aiResponse.scores.language.toString());
        formData.append("organizationScore", aiResponse.scores.organization.toString());
        formData.append("totalScore", aiResponse.scores.overall.toString());

        const essayResponse = await fetch("/api/essays", {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
          body: formData,
        });

        if (!essayResponse.ok) {
          const errorData = await essayResponse.json();
          throw new Error(errorData.error || `Failed to submit essay: ${essayResponse.status}`);
        }
        
        // Get the essay ID from the response
        const essayData = await essayResponse.json();
        if (essayData?.id) {
          setLastSubmittedEssayId(essayData.id);
        }
        
        setCompletedCount(prev => prev + 1);
        toast({ 
          title: `Essay ${completedCount} analyzed`, 
          description: `Score: ${aiResponse.scores.overall}/100` 
        });
      }
    } catch (err: any) {
      console.error("AI processing error:", err);
      const errorMessage = err.message || "Failed to process the essay with AI.";
      
      // Update essay with error
      setEssays(prev => prev.map(essay => 
        essay.id === essayId ? { ...essay, status: 'error', error: errorMessage } : essay
      ));
      
      toast({ 
        variant: "destructive", 
        title: "AI Processing Failed", 
        description: errorMessage 
      });
    }
  };

  const addTypedEssay = () => {
    if (!content.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Empty Content", 
        description: "Please enter some content for the essay." 
      });
      return;
    }

    const newEssay: EssayFile = {
      id: `essay-typed-${Date.now()}`,
      file: new File([content], `typed-essay-${Date.now()}.txt`, { type: 'text/plain' }),
      content: content,
      status: 'completed'
    };

    setEssays(prev => [...prev, newEssay]);
    setContent("");
    
    toast({ 
      title: "Essay Added", 
      description: "Your typed essay has been added to the list." 
    });
  };

  const isStep1Complete = !!question;
  const hasValidEssays = essays.some(essay => essay.status === 'completed' && essay.content.trim() !== "") || content.trim() !== "";

  const renderFileUpload = (type: 'question' | 'essays') => (
            <div className="space-y-2">
      <label htmlFor={`${type}-file-upload`} className="text-sm font-medium">
        {type === 'question' ? 'Upload File (Optional)' : 'Upload Essays'}
              </label>
              <div className="flex items-center gap-4">
                <Input
          id={`${type}-file-upload`}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/tiff,image/webp,image/gif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={type === 'question' ? handleQuestionFileChange : handleEssayFilesChange}
                  className="w-full"
          disabled={extractingText || (type === 'essays' && !isStep1Complete)}
          multiple={type === 'essays'}
        />
        {type === 'question' && questionFile && !extractingText && (
          <p className="text-sm text-muted-foreground truncate max-w-[150px]">
            {questionFile.name}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
        {type === 'question' 
          ? 'Upload a document or image to extract the question text using OCR, or type manually.'
          : 'Upload multiple documents or images to extract essay content using OCR. You can select multiple files at once.'}
      </p>
      {extractingText && extractingFor === (type === 'question' ? 'question' : 'content') && (
        <div className="mt-4 space-y-3 py-4 px-4 bg-muted rounded-md text-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2 mx-auto text-primary" />
          <div className="text-sm font-medium">{processingMessage}</div>
          <p className="text-xs text-muted-foreground">This may take a minute.</p>
          {processingProgress > 0 && (
            <Progress value={processingProgress} className="h-2 mt-2" />
          )}
        </div>
      )}
            </div>
  );

  const navigateEssay = (direction: 'prev' | 'next') => {
    const essaysWithFeedback = essays.filter(e => e.feedback);
    if (essaysWithFeedback.length === 0) return;
    
    if (direction === 'prev') {
      setActiveEssayIndex(prev => (prev > 0 ? prev - 1 : essaysWithFeedback.length - 1));
    } else {
      setActiveEssayIndex(prev => (prev < essaysWithFeedback.length - 1 ? prev + 1 : 0));
    }
  };

  const activeEssay = essays.filter(e => e.feedback)[activeEssayIndex];

  // Add this function to handle essay preview
  const handlePreviewEssay = (essay: EssayFile) => {
    setPreviewEssay(essay);
    setShowPreviewDialog(true);
  };

  return (
    <div className="container py-10 max-w-4xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Batch Essay Submission</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload & Process</TabsTrigger>
          <TabsTrigger value="results" disabled={!essays.some(e => e.feedback)}>View Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-8">
          {/* Step 1: Essay Question */}
          <Card className="transition-opacity duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                Essay Question/Prompt
                {isStep1Complete && <Check className="h-5 w-5 text-green-500" />}
              </CardTitle>
              <CardDescription>
                Enter the question or prompt for all essays. You can type it directly or upload a file/image.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="question" className="text-sm font-medium">Question/Prompt</label>
                <Textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type the essay question here..."
                  rows={3}
                  disabled={extractingText && extractingFor === 'question'}
                />
              </div>
              {renderFileUpload('question')}
            </CardContent>
          </Card>

          {/* Step 2: Essay Uploads */}
          <Card className={`transition-opacity duration-300 ${isStep1Complete ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${isStep1Complete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                Essay Uploads
                {hasValidEssays && <Check className="h-5 w-5 text-green-500" />}
              </CardTitle>
              <CardDescription>
                Upload multiple essays related to the question. All essays will be processed in batch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mb-4">
                <Label htmlFor="essays-text">Essay Content</Label>
                <Textarea 
                  id="essays-text"
                  className="h-64"
                  placeholder="Enter your essay text here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <Button 
                  className="mt-2" 
                  variant="outline" 
                  onClick={addTypedEssay}
                  disabled={!content.trim()}
                >
                  Add as Essay
                </Button>
              </div>

              {renderFileUpload('essays')}
              
              {/* Essay List */}
              {essays.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Uploaded Essays ({essays.length})</h3>
                  <ScrollArea className="h-[250px] rounded-md border p-4">
                    <div className="space-y-2">
                      {essays.map((essay) => (
                        <div 
                          key={essay.id} 
                          className="flex items-center justify-between p-2 rounded-md border"
                        >
                          <div className="flex items-center gap-2 flex-grow overflow-hidden">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm truncate">{essay.file.name}</span>
                            <Badge variant={
                              essay.status === 'completed' ? 'default' : 
                              essay.status === 'processing' ? 'secondary' : 
                              essay.status === 'error' ? 'destructive' : 'outline'
                            }>
                              {essay.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {essay.status === 'completed' && essay.content && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreviewEssay(essay)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeEssay(essay.id)}
                              disabled={aiProcessing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  </div>
                )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                onClick={handleSubmit}
                disabled={loading || extractingText || aiProcessing || !isStep1Complete || !hasValidEssays}
              >
                {aiProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{processingMessage}</>
                ) : loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  "Analyze & Submit All Essays"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          {essays.some(e => e.feedback) ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Analysis Results</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => navigateEssay('prev')}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {activeEssayIndex + 1} / {essays.filter(e => e.feedback).length}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => navigateEssay('next')}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Question: {question?.split("\n")[0] || question}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeEssay && (
                  <div>
                    <div className="mb-4 font-medium">
                      Essay: {activeEssay.file.name}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                      {/* Score displays */}
                      {[
                        { label: "Overall", score: activeEssay.scores?.overall || 0 },
                        { label: "Content", score: activeEssay.scores?.content || 0 },
                        { label: "Language", score: activeEssay.scores?.language || 0 },
                        { label: "Organization", score: activeEssay.scores?.organization || 0 },
                      ].map(({ label, score }) => (
                        <div key={label} className="bg-primary/10 p-2 text-center rounded">
                          <div className="font-bold text-2xl">{score}</div>
                          <div className="text-xs">{label}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="font-medium mb-2">Essay Content:</h3>
                      <ScrollArea className="h-[200px] rounded-md border p-4">
                        <div className="whitespace-pre-line text-sm">
                          {activeEssay.content}
                        </div>
                      </ScrollArea>
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="font-medium mb-2">Feedback:</h3>
                      <ScrollArea className="h-[200px] rounded-md border p-4">
                        <div className="whitespace-pre-line text-sm">
                          {activeEssay.feedback}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("upload")}
                >
                  Back to Upload
                </Button>
                <Button 
                  onClick={() => router.push("/essays")}
                >
                  View All Saved Essays
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Results</h3>
                  <p className="text-muted-foreground mb-4">
                    You need to process essays to see analysis results.
                  </p>
                  <Button onClick={() => setActiveTab("upload")}>
                    Go to Upload
              </Button>
            </div>
        </CardContent>
      </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Add the Dialog component outside of the main return but still within the component function */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">Essay Preview</DialogTitle>
            <DialogDescription>
              Preview the essay content before submitting for analysis
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 overflow-hidden">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Question:</h3>
                <div className="bg-muted p-4 rounded-md overflow-hidden">
                  <p className="whitespace-pre-line break-words">{question}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Essay Content:</h3>
                <ScrollArea className="h-[40vh] w-full rounded-md border">
                  <div className="bg-muted p-4 rounded-md">
                    <p className="whitespace-pre-line break-words w-full pr-4">{previewEssay?.content}</p>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 