'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Droplet, Shield, MapPin, Clock, Zap, Activity, CheckCircle 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-red-500/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-sm font-medium mb-8 border border-red-500/20">
              <Activity className="w-4 h-4" />
              <span>Emergency Coordination Network</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
              Every Second Matters.<br />
              Every Match Counts.
            </h1>
            
            <p className="mt-4 text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              RakthSetu connects emergency blood requirements with verified, available resources through intelligent location-aware coordination.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/login" 
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-2"
              >
                Access Emergency Network
              </Link>
              <button 
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-lg transition-all"
              >
                Explore Platform
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-slate-800/50 bg-slate-900/20 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-slate-500 font-medium mb-8 uppercase tracking-wider text-sm">
            Trusted by emergency networks
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">&lt; 5 min</div>
              <div className="text-slate-400 text-sm">Response Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">99.8%</div>
              <div className="text-slate-400 text-sm">Matching Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">50km</div>
              <div className="text-slate-400 text-sm">Radius Coverage</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">24/7</div>
              <div className="text-slate-400 text-sm">Active Operations</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
              <Zap className="w-12 h-12 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-slate-100">Intelligent Matching</h3>
              <p className="text-slate-400 leading-relaxed">
                Deterministic compatibility engine evaluates blood group, location, availability, and verification to identify optimal resources in seconds.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
              <Clock className="w-12 h-12 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-slate-100">Real-Time Coordination</h3>
              <p className="text-slate-400 leading-relaxed">
                Live emergency tracking from request creation through fulfillment. Every state transition is recorded and visible.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
              <MapPin className="w-12 h-12 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-slate-100">Location Intelligence</h3>
              <p className="text-slate-400 leading-relaxed">
                Geospatial search with automatic radius expansion finds verified resources within configurable emergency zones.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-slate-900/20 border-t border-slate-800/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-slate-100">
            How the Network Operates
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-12">
              {[
                { title: "Hospital creates emergency request", icon: Shield },
                { title: "Engine matches compatible resources", icon: Zap },
                { title: "Resources are notified and respond", icon: Clock },
                { title: "Fulfillment is tracked end-to-end", icon: CheckCircle }
              ].map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-6"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-slate-200 mb-2">
                      Step {idx + 1}: {step.title}
                    </h4>
                    <div className="h-0.5 w-12 bg-slate-800 mt-4" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/50 bg-slate-950">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-400 font-medium mb-4">
            RakthSetu &copy; 2026 | Emergency Coordination Network
          </p>
          <p className="text-slate-600 text-sm max-w-2xl mx-auto">
            Disclaimer: This platform provides operational coordination. Clinical decisions remain with authorized medical professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}
