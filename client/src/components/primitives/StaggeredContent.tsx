import React from 'react';
import { motion } from 'framer-motion';

interface StaggeredContentProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const StaggeredContent: React.FC<StaggeredContentProps> = ({ 
  children, 
  className = "", 
  delay = 0.1 
}) => {
  return (
    <motion.div 
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.4,
            ease: "easeOut"
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
};

export const StaggeredContainer: React.FC<StaggeredContentProps> = ({ 
  children, 
  className = "", 
  delay = 0.1 
}) => {
  return (
    <motion.div 
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: 0.1
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
};