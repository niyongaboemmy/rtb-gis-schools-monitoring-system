import React from "react";
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  ChevronUp, 
  ChevronDown,
  RotateCcw,
  RotateCw,
  Zap,
  Footprints
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";

interface ViewerMovementControlsProps {
  keysRef: React.MutableRefObject<Set<string>>;
  isSprinting: boolean;
  setIsSprinting: (val: boolean) => void;
}

export const ViewerMovementControls: React.FC<ViewerMovementControlsProps> = ({ 
  keysRef, 
  isSprinting, 
  setIsSprinting 
}) => {
  const handleStart = (key: string) => {
    keysRef.current.add(key);
  };

  const handleEnd = (key: string) => {
    keysRef.current.delete(key);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 pointer-events-none">
        
        {/* Sprint Toggle */}
        <div className="pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isSprinting ? "default" : "outline"}
                className={cn(
                  "w-10 h-10 rounded-xl transition-all duration-300 shadow-xl border border-white/10",
                  isSprinting 
                    ? "bg-amber-500 hover:bg-amber-600 text-white scale-110 shadow-amber-500/20" 
                    : "bg-background/80 backdrop-blur-2xl hover:bg-white/10"
                )}
                onClick={() => setIsSprinting(!isSprinting)}
              >
                {isSprinting ? <Zap className="w-5 h-5 fill-current" /> : <Footprints className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isSprinting ? "Walking Mode" : "Sprint Mode"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex gap-3 items-end pointer-events-auto">
          {/* Height & Rotation Grid */}
          <Card className="bg-background/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-1.5 shadow-2xl flex flex-col gap-1">
            {/* Top Row: Height Controls */}
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10"
                    onPointerDown={() => handleStart(" ")}
                    onPointerUp={() => handleEnd(" ")}
                    onPointerLeave={() => handleEnd(" ")}
                  >
                    <ChevronUp className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Rise (Space)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10"
                    onPointerDown={() => handleStart("q")}
                    onPointerUp={() => handleEnd("q")}
                    onPointerLeave={() => handleEnd("q")}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Lower (Q)</TooltipContent>
              </Tooltip>
            </div>

            {/* Separator */}
            <div className="h-px bg-white/10 mx-1" />

            {/* Bottom Row: Rotation Controls */}
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 text-amber-400/80"
                    onPointerDown={() => handleStart("rotateLeft")}
                    onPointerUp={() => handleEnd("rotateLeft")}
                    onPointerLeave={() => handleEnd("rotateLeft")}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Rotate Left</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 text-amber-400/80"
                    onPointerDown={() => handleStart("rotateRight")}
                    onPointerUp={() => handleEnd("rotateRight")}
                    onPointerLeave={() => handleEnd("rotateRight")}
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Rotate Right</TooltipContent>
              </Tooltip>
            </div>
          </Card>

          {/* D-Pad Horizontal Movement */}
          <Card className="bg-background/80 backdrop-blur-2xl rounded-[24px] border border-white/10 p-2 shadow-2xl flex flex-col items-center gap-1">
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-white/10"
                onPointerDown={() => handleStart("w")}
                onPointerUp={() => handleEnd("w")}
                onPointerLeave={() => handleEnd("w")}
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex gap-1 justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-white/10"
                onPointerDown={() => handleStart("a")}
                onPointerUp={() => handleEnd("a")}
                onPointerLeave={() => handleEnd("a")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 flex items-center justify-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-white/10"
                onPointerDown={() => handleStart("d")}
                onPointerUp={() => handleEnd("d")}
                onPointerLeave={() => handleEnd("d")}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-white/10"
                onPointerDown={() => handleStart("s")}
                onPointerUp={() => handleEnd("s")}
                onPointerLeave={() => handleEnd("s")}
              >
                <ArrowDown className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};
