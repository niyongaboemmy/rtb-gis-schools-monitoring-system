interface ImigongoPatternProps {
  className?: string;
  opacity?: number;
  scale?: number;
}

export const ImigongoPattern = ({ 
  className, 
  opacity = 0.08, 
  scale = 1.2 
}: ImigongoPatternProps) => (
  <div className={className} style={{ opacity }}>
    <svg 
      width="100%" 
      height="100%" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern 
          id="imigongo-shared" 
          width="80" 
          height="80" 
          patternUnits="userSpaceOnUse" 
          patternTransform={`scale(${scale})`}
        >
          <path 
            d="M0,10 L40,-20 L80,10 L80,30 L40,0 L0,30 Z M0,50 L40,20 L80,50 L80,70 L40,40 L0,70 Z M0,90 L40,60 L80,90 L80,110 L40,80 L0,110 Z" 
            fill="currentColor" 
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#imigongo-shared)" />
    </svg>
  </div>
);
