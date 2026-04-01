import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ViewerCameraNavProps {
  setView: (dir: "top" | "front" | "back" | "left" | "right") => void;
}

export const ViewerCameraNav: React.FC<ViewerCameraNavProps> = ({ setView }) => {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-2">
        <Card className="bg-background/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-1.5 flex flex-col gap-1 shadow-2xl pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                onClick={() => setView("top")}
              >
                TOP
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Top View</TooltipContent>
          </Tooltip>
          
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-10 text-[9px] font-black uppercase tracking-tight hover:bg-white/10"
                  onClick={() => setView("front")}
                >
                  FRT
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Front View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-10 text-[9px] font-black uppercase tracking-tight hover:bg-white/10"
                  onClick={() => setView("back")}
                >
                  BCK
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Back View</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-10 text-[9px] font-black uppercase tracking-tight hover:bg-white/10"
                  onClick={() => setView("left")}
                >
                  LFT
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Left View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-10 text-[9px] font-black uppercase tracking-tight hover:bg-white/10"
                  onClick={() => setView("right")}
                >
                  RGT
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Right View</TooltipContent>
            </Tooltip>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default React.memo(ViewerCameraNav);
