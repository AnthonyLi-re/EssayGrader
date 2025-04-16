import { Card, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">About EssayGrader</h1>
      
      <div className="max-w-none">
        <p className="text-lg md:text-xl mb-8">
          EssayGrader is an AI-powered platform for automated essay grading, specifically tailored 
          to the Hong Kong education system (HKDSE and TSA exam frameworks).
        </p>
        
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <Card className="h-full">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-4">Our Mission</h3>
              <p className="text-base md:text-lg">
                We aim to reduce essay grading time from 8 hours to 5 minutes while providing 
                detailed, personalized feedback to students, helping them improve their writing
                skills and achieve better results in their exams.
              </p>
            </CardContent>
          </Card>
          
          <Card className="h-full">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-4">How It Works</h3>
              <p className="text-base md:text-lg">
                Our platform uses advanced AI models to analyze essays based on DSE/TSA evaluation 
                criteria. It provides comprehensive feedback on Content, Language, and Organization,
                along with personalized suggestions for improvement.
              </p>
            </CardContent>
          </Card>
        </div>
        
        <h2 className="text-2xl font-bold mb-6">Key Features</h2>
        
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          <div className="border rounded-lg p-6 h-full">
            <h3 className="text-lg font-bold mb-3">Essay Assessment</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>DSE/TSA-based evaluation criteria</li>
              <li>Content, Language, and Organization scores</li>
              <li>Real-time error detection</li>
            </ul>
          </div>
          
          <div className="border rounded-lg p-6 h-full">
            <h3 className="text-lg font-bold mb-3">Smart Feedback</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Correction suggestions</li>
              <li>Word choice recommendations</li>
              <li>Structure and style analysis</li>
              <li>Content relevance assessment</li>
            </ul>
          </div>
          
          <div className="border rounded-lg p-6 h-full">
            <h3 className="text-lg font-bold mb-3">Teacher Tools</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Exercise generation</li>
              <li>Student performance analytics</li>
              <li>Batch essay processing</li>
              <li>Export functionality</li>
            </ul>
          </div>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">For Students</h2>
            <p className="text-base md:text-lg">
              EssayGrader helps you improve your writing skills by providing immediate, 
              detailed feedback on your essays. You'll understand your strengths and 
              weaknesses, learn from your mistakes, and track your progress over time.
            </p>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-4">For Teachers</h2>
            <p className="text-base md:text-lg">
              Our platform saves you hours of grading time while providing consistent, 
              objective assessments based on DSE/TSA criteria. You can focus on high-value 
              activities like personalized instruction and curriculum development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 