import React from 'react';
import { motion } from 'motion/react';

export default function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <motion.path
        d="M20 30L50 80L80 30"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <motion.circle
        cx="50"
        cy="40"
        r="8"
        fill="currentColor"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 10 }}
      />
      <motion.path
        d="M10 50L30 50"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 0.5 }}
        transition={{ delay: 1, duration: 0.8 }}
      />
      <motion.path
        d="M90 50L70 50"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 0.5 }}
        transition={{ delay: 1, duration: 0.8 }}
      />
    </svg>
  );
}
