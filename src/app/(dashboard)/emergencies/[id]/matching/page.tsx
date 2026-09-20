'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Activity, 
  Search, 
  ShieldCheck, 
  Calculator, 
  Trophy,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { IMatch } from '@/types';

const STEPS = [
  { id: 1, label: 'Request validated', icon: CheckCircle2 },
  { id: 2, label: 'Component compatibility checked', icon: Activity },
  { id: 3, label: 'Nearby resources located', icon: Search },
  { id: 4, label: 'Availability verified', icon: ShieldCheck },
  { id: 5, label: 'Resource priority calculated', icon: Calculator },
  { id: 6, label: 'Top matches identified', icon: Trophy },
];

export default function LiveMatchingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [matches, setMatches] = useState<IMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const runMatchingEngine = async () => {
      try {
        const res = await fetch(`/api/emergencies/${id}/match`, {
          method: 'POST',
        });
        const data = await res.json();
        
        if (data.success && isMounted) {
          setMatches(data.data || []);
        } else if (!data.success && isMounted) {
          setError(data.message || 'Failed to run matching engine');
        }
      } catch (err) {
        if (isMounted) {
          setError('Network error occurred during matching');
        }
      }
    };

    runMatchingEngine();

    // Animate steps
    const timers: NodeJS.Timeout[] = [];
    
    STEPS.forEach((step, index) => {
      timers.push(
        setTimeout(() => {
          if (isMounted) setCurrentStep(index + 1);
        }, (index + 1) * 800) // 800ms per step
      );
    });

    timers.push(
      setTimeout(() => {
        if (isMounted) setIsComplete(true);
      }, (STEPS.length + 1) * 800)
    );

    return () => {
      isMounted = false;
      timers.forEach(clearTimeout);
    };
  }, [id]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 max-w-3xl mx-auto w-full">
      
      {!isComplete ? (
        <Card className="w-full bg-zinc-950/80 border-zinc-800 p-8 md:p-12 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-10 text-center">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-zinc-100 flex items-center justify-center gap-3">
                <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
                Matching Engine Running
              </h1>
              <p className="text-zinc-400 font-mono text-sm">Processing Request ID: {id}</p>
            </div>

            <div className="w-full max-w-md space-y-4">
              {STEPS.map((step, index) => {
                const isActive = currentStep === index;
                const isDone = currentStep > index;
                const Icon = step.icon;
                
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: isDone || isActive ? 1 : 0.3, 
                      x: 0,
                      scale: isActive ? 1.02 : 1
                    }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      isActive ? 'bg-blue-500/10 border-blue-500/30' : 
                      isDone ? 'bg-emerald-500/5 border-emerald-500/20' : 
                      'bg-zinc-900/50 border-zinc-800/50'
                    }`}
                  >
                    <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
                      isActive ? 'bg-blue-500 text-white animate-pulse' :
                      isDone ? 'bg-emerald-500 text-white' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`font-medium ${
                      isActive ? 'text-blue-100' :
                      isDone ? 'text-emerald-100' :
                      'text-zinc-500'
                    }`}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
            
            {error && (
              <div className="mt-8 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 w-full text-center">
                {error}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex flex-col gap-6"
        >
          <div className="text-center space-y-4 mb-4">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-100">MATCHING COMPLETE</h1>
              <p className="text-zinc-400 mt-2">Found {matches.length} compatible resources</p>
            </div>
          </div>

          <div className="space-y-3 w-full max-w-2xl mx-auto">
            <AnimatePresence>
              {matches.slice(0, 5).map((match, i) => (
                <motion.div
                  key={match._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <Card className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 transition-colors">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-zinc-400 text-sm font-bold">
                          #{match.rank}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200">
                            {match.resourceType === 'BLOOD_BANK' ? match.bloodBank?.name || 'Blood Bank' : match.donor?.userId || 'Donor'}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] uppercase text-zinc-400 bg-zinc-900">{match.resourceType.replace('_', ' ')}</Badge>
                            <span className="text-xs text-zinc-500">{match.distanceKm.toFixed(1)} km away</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-2xl font-bold font-mono ${getScoreColor(match.score)}`}>
                        {match.score}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex justify-center mt-6">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push(`/emergencies/${id}`)}>
              View Request Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
