import { Users, BarChart3, Map as MapIcon, Share2 } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function PopulationAnalytics() {
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Population Analytics"
        description="Integrate ArcGIS demographic data with institutional GIS buffers."
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/20 shadow-none hover:bg-primary/5 transition-all">
              <MapIcon className="mr-2 h-3.5 w-3.5" />
              Layer Settings
            </Button>
            <Button variant="outline" className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/20 shadow-none hover:bg-primary/5 transition-all">
              <Share2 className="mr-2 h-3.5 w-3.5" />
              Export GIS
            </Button>
            <Button className="rounded-full h-10 px-6 font-black uppercase tracking-wider text-[10px] bg-linear-to-r from-primary to-primary/80 shadow-none hover:opacity-90 transition-all">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze Buffers
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/20 bg-card/40 backdrop-blur-sm rounded-3xl min-h-[500px] flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <CardContent className="text-center space-y-4 relative z-10">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto border border-primary/10 mb-2">
              <MapIcon className="w-10 h-10 text-primary/40 animate-pulse" />
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full border-primary/20 text-primary text-[8px] font-black uppercase px-3">Engine Initializing</Badge>
              <h3 className="text-xl font-bold uppercase tracking-tight">Spatial Intelligence Map</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Demographic heatmaps and catchment area dynamics are being computed for the current GPS viewport.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-3xl p-6 shadow-none">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Live Demographics</h4>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-muted-foreground/60">Sample Metric {i}</span>
                    <span className="text-primary">--%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/20 w-1/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-3xl p-6 shadow-none flex-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Institutional Reach</h4>
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
              <Users className="w-12 h-12 mb-2" />
              <p className="text-[10px] font-bold uppercase">Awaiting GIS Data</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

