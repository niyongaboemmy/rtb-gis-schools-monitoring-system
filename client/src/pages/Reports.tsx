import { FileText, Download, Filter, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';

export default function Reports() {
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Exportable Reports"
        description="Generate comprehensive status reports for individual schools or sectors."
        icon={FileText}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search report archives..." 
                className="h-10 pl-9 rounded-full border-border/20 bg-background/50 text-[10px] w-48 shadow-none"
              />
            </div>
            <Button variant="outline" className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/20 shadow-none hover:bg-primary/5 transition-all">
              <Filter className="mr-2 h-3.5 w-3.5" />
              Filter
            </Button>
            <Button className="rounded-full h-10 px-6 font-black uppercase tracking-wider text-[10px] bg-linear-to-r from-primary to-primary/80 shadow-none hover:opacity-90 transition-all">
              <Download className="mr-2 h-4 w-4" />
              Generate All
            </Button>
          </div>
        }
      />

      <Card className="border border-dashed border-border/40 bg-card/40 backdrop-blur-sm rounded-3xl min-h-[400px] flex items-center justify-center">
        <CardContent className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto border border-primary/10">
            <FileText className="w-8 h-8 text-primary/40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold uppercase tracking-tighter">Archives are Synchronizing</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Institutional PDF and Excel export utilities are being initialized against the latest GIS telemetry.
            </p>
          </div>
          <Button variant="outline" className="rounded-full mt-2 border-border/20 shadow-none text-[10px] font-black uppercase tracking-widest">
            Refresh Data Index
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

