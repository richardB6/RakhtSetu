'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Shield, MapPin, Clock, Zap, Activity, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent text-foreground font-sans selection:bg-red-500/20">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Image
              src="/rakthsetu-logo.png"
              alt="RakthSetu"
              width={168}
              height={168}
              priority
              className="mx-auto mb-6 h-32 w-32 rounded-[1.75rem] object-cover shadow-[0_12px_35px_rgba(252,185,181,0.28)] md:h-40 md:w-40"
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-8 border border-border">
              <Activity className="w-4 h-4" />
              <span>Emergency Coordination Network</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-foreground">
              Every Second Matters.<br />
              Every Match Counts.
            </h1>
            
            <p className="mt-4 text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              RakthSetu connects emergency blood requirements with verified, available resources through intelligent location-aware coordination.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/login" 
                className="primary-action px-8 py-4 bg-primary text-white rounded-lg font-semibold text-lg flex items-center gap-2"
              >
                Access Emergency Network
              </Link>
              <button 
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="secondary-action px-8 py-4 bg-white hover:bg-accent text-primary border border-border rounded-lg font-semibold text-lg"
              >
                Explore Platform
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-white/70 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-muted-foreground font-medium mb-8 uppercase tracking-wider text-sm">
            Trusted by emergency networks
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground mb-2">&lt; 5 min</div>
              <div className="text-muted-foreground text-sm">Response Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground mb-2">99.8%</div>
              <div className="text-muted-foreground text-sm">Matching Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground mb-2">50km</div>
              <div className="text-muted-foreground text-sm">Radius Coverage</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground mb-2">24/7</div>
              <div className="text-muted-foreground text-sm">Active Operations</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            <div className="surface-card p-8">
              <Zap className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-foreground">Intelligent Matching</h3>
              <p className="text-muted-foreground leading-relaxed">
                Deterministic compatibility engine evaluates blood group, location, availability, and verification to identify optimal resources in seconds.
              </p>
            </div>
            <div className="surface-card p-8">
              <Clock className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-foreground">Real-Time Coordination</h3>
              <p className="text-muted-foreground leading-relaxed">
                Live emergency tracking from request creation through fulfillment. Every state transition is recorded and visible.
              </p>
            </div>
            <div className="surface-card p-8">
              <MapPin className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-foreground">Location Intelligence</h3>
              <p className="text-muted-foreground leading-relaxed">
                Geospatial search with automatic radius expansion finds verified resources within configurable emergency zones.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white/60 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">
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
                  <div className="step-marker flex-shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary font-bold">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Step {idx + 1}: {step.title}
                    </h4>
                    <div className="h-0.5 w-12 bg-border mt-4" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-white/70">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground font-medium mb-4">
            RakthSetu &copy; 2026 | Emergency Coordination Network
          </p>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Disclaimer: This platform provides operational coordination. Clinical decisions remain with authorized medical professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}
