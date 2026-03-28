import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Modal } from "./ui/modal";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardCheck,
  Building2,
  BookOpen,
  FlaskConical,
  Utensils,
  Home,
  Users,
  Wrench,
  Monitor,
  Dumbbell,
  Bed,
  DoorOpen,
  TreePine,
  Fence,
  Hospital,
} from "lucide-react";

type ComplianceLevel = "compliant" | "partial" | "non_compliant";

interface FacilityItem {
  id: string;
  label: string;
  tags: string[];
}

interface Facility {
  facilityId: string;
  title: string;
  items: FacilityItem[];
}

interface SurveyItem {
  id: string;
  facilityId: string;
  itemId: string;
  compliance: ComplianceLevel;
  notes?: string;
  inspectedBy?: string;
  inspectedAt?: string;
}

interface FacilitySurveyFormProps {
  schoolId: string;
  schoolName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function FacilitySurveyForm({
  schoolId,
  schoolName,
  isOpen = true,
  onClose,
}: FacilitySurveyFormProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surveyData, setSurveyData] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectedBy, setInspectedBy] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Map facility IDs to step icons
  const getStepIcon = (facilityId: string) => {
    const icons: Record<string, React.ReactNode> = {
      administration: <Building2 className="w-5 h-5" />,
      classroom: <BookOpen className="w-5 h-5" />,
      smart_classroom: <Monitor className="w-5 h-5" />,
      science_lab: <FlaskConical className="w-5 h-5" />,
      language_lab: <BookOpen className="w-5 h-5" />,
      special_needs: <Users className="w-5 h-5" />,
      library: <BookOpen className="w-5 h-5" />,
      tvet_workshop: <Wrench className="w-5 h-5" />,
      teacher_center: <Users className="w-5 h-5" />,
      kitchen: <Utensils className="w-5 h-5" />,
      dining: <Utensils className="w-5 h-5" />,
      multipurpose: <Users className="w-5 h-5" />,
      sports: <Dumbbell className="w-5 h-5" />,
      sleeping: <Bed className="w-5 h-5" />,
      dormitories: <Home className="w-5 h-5" />,
      sickbay: <Hospital className="w-5 h-5" />,
      girls_room: <Bed className="w-5 h-5" />,
      washrooms: <DoorOpen className="w-5 h-5" />,
      residence: <Home className="w-5 h-5" />,
      outdoor: <TreePine className="w-5 h-5" />,
      fencing: <Fence className="w-5 h-5" />,
    };
    return icons[facilityId] || <Building2 className="w-5 h-5" />;
  };

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const facilitiesRes = await api.get("/schools/facilities");
      setFacilities(facilitiesRes.data);

      const surveyRes = await api.get(`/schools/${schoolId}/survey`);
      setSurveyData(surveyRes.data);

      if (surveyRes.data.length > 0) {
        setInitialized(true);
        // Set current step to first facility
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error loading survey data:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeSurvey = async () => {
    if (!inspectedBy.trim()) {
      alert("Please enter your name as the inspector");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post(`/schools/${schoolId}/survey/initialize`, {
        inspectedBy: inspectedBy.trim(),
      });
      setSurveyData(res.data);
      setInitialized(true);
      setCurrentStep(1);
    } catch (error) {
      console.error("Error initializing survey:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCompliance = (
    surveyItem: SurveyItem,
    newCompliance: ComplianceLevel,
  ) => {
    setSurveyData((prev) =>
      prev.map((item) =>
        item.id === surveyItem.id
          ? { ...item, compliance: newCompliance }
          : item,
      ),
    );
  };

  const updateNotes = (surveyItem: SurveyItem, notes: string) => {
    setSurveyData((prev) =>
      prev.map((item) =>
        item.id === surveyItem.id ? { ...item, notes } : item,
      ),
    );
  };

  const saveSurvey = async () => {
    try {
      setSaving(true);
      const updates = surveyData.map((item) => ({
        itemId: item.itemId,
        facilityId: item.facilityId,
        compliance: item.compliance,
        notes: item.notes,
      }));

      await api.patch(`/schools/${schoolId}/survey`, updates);
      alert("Survey saved successfully!");
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Failed to save survey");
    } finally {
      setSaving(false);
    }
  };

  const getComplianceColor = (compliance: ComplianceLevel) => {
    switch (compliance) {
      case "compliant":
        return "bg-green-500/10 border-green-500/30 text-green-600";
      case "partial":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600";
      case "non_compliant":
        return "bg-red-500/10 border-red-500/30 text-red-600";
    }
  };

  const getComplianceIcon = (compliance: ComplianceLevel) => {
    switch (compliance) {
      case "compliant":
        return <CheckCircle2 className="h-4 w-4" />;
      case "partial":
        return <MinusCircle className="h-4 w-4" />;
      case "non_compliant":
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getComplianceStats = () => {
    const compliant = surveyData.filter(
      (s) => s.compliance === "compliant",
    ).length;
    const partial = surveyData.filter((s) => s.compliance === "partial").length;
    const nonCompliant = surveyData.filter(
      (s) => s.compliance === "non_compliant",
    ).length;
    return { compliant, partial, nonCompliant, total: surveyData.length };
  };

  const getStepCompliance = (stepIndex: number) => {
    if (!facilities[stepIndex]) return 0;
    const facility = facilities[stepIndex];
    const facilityItems = surveyData.filter(
      (s) => s.facilityId === facility.facilityId,
    );
    return facilityItems.filter((s) => s.compliance === "compliant").length;
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  if (loading && !initialized) {
    return (
      <Modal
        isOpen={isOpen ?? true}
        onClose={handleClose}
        maxWidth="max-w-4xl"
        className="max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Modal>
    );
  }

  if (!initialized) {
    return (
      <Modal
        isOpen={isOpen ?? true}
        onClose={handleClose}
        maxWidth="max-w-2xl"
        className="max-h-[90vh] overflow-y-auto"
      >
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Initialize Facility Survey</h2>
              <p className="text-muted-foreground">For: {schoolName}</p>
            </div>
          </div>

          <Card className="border-2 border-dashed border-primary/20">
            <CardContent className="p-6 space-y-4">
              <p className="text-muted-foreground">
                This will create a new survey for <strong>{schoolName}</strong>{" "}
                with all facility items set to <strong>Non-Compliant</strong> by
                default. You can then update each item's compliance level.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Inspector Name</label>
                <Input
                  placeholder="Enter your name"
                  value={inspectedBy}
                  onChange={(e) => setInspectedBy(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button
                onClick={initializeSurvey}
                disabled={loading}
                className="w-full h-12 text-lg font-semibold"
              >
                {loading ? "Initializing..." : "Start Survey"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Modal>
    );
  }

  const stats = getComplianceStats();
  const currentFacility = facilities[currentStep - 1];
  const currentFacilityItems = currentFacility
    ? surveyData.filter((s) => s.facilityId === currentFacility.facilityId)
    : [];

  return (
    <Modal
      isOpen={isOpen ?? true}
      onClose={handleClose}
      maxWidth="max-w-[1400px]"
      className="h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-[calc(100vw-40px)] md:w-[calc(100vw-80px)]"
    >
      <div className="flex h-full -m-6">
        {/* Left Sidebar */}
        <div
          className="w-80 min-w-[280px] bg-linear-to-b from-primary/10 via-primary/5 to-background border-r border-border/50 flex flex-col"
          style={{ height: "calc(100vh - 100px)" }}
        >
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Facility Survey</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{schoolName}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
            {facilities.map((facility, index) => {
              const stepCompliance = getStepCompliance(index);
              const totalItems = surveyData.filter(
                (s) => s.facilityId === facility.facilityId,
              ).length;
              const isComplete =
                stepCompliance === totalItems && totalItems > 0;

              return (
                <button
                  key={facility.facilityId}
                  type="button"
                  onClick={() => setCurrentStep(index + 1)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left ${
                    currentStep === index + 1
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : isComplete
                        ? "bg-green-500/10 text-green-600"
                        : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      currentStep === index + 1
                        ? "bg-white/20"
                        : isComplete
                          ? "bg-green-500"
                          : "bg-muted"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      getStepIcon(facility.facilityId)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {facility.title}
                    </div>
                    <div
                      className={`text-xs ${
                        currentStep === index + 1
                          ? "text-white/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {stepCompliance}/{totalItems} compliant
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {stats.compliant}/{stats.total} Total Compliant
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 border-green-500/30"
              >
                {stats.compliant} ✓
              </Badge>
              <Badge
                variant="outline"
                className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
              >
                {stats.partial} ~
              </Badge>
              <Badge
                variant="outline"
                className="bg-red-500/10 text-red-600 border-red-500/30"
              >
                {stats.nonCompliant} ✗
              </Badge>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="overflow-y-auto p-8"
            style={{ height: "calc(100vh - 170px)" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto"
              >
                {currentFacility && (
                  <Card className="border-2 border-border/50 shadow-lg">
                    <CardHeader className="bg-muted/30 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            {getStepIcon(currentFacility.facilityId)}
                          </div>
                          <div>
                            <CardTitle className="text-xl">
                              {currentFacility.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {
                                currentFacilityItems.filter(
                                  (s) => s.compliance === "compliant",
                                ).length
                              }
                              /{currentFacilityItems.length} compliant
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={saveSurvey}
                          disabled={saving}
                          className="rounded-full font-semibold"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {currentFacility.items.map((item) => {
                        const surveyItem = surveyData.find(
                          (s) =>
                            s.facilityId === currentFacility.facilityId &&
                            s.itemId === item.id,
                        );

                        if (!surveyItem) return null;

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border-2 ${getComplianceColor(surveyItem.compliance)}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                      surveyItem.compliance === "compliant"
                                        ? "bg-green-500/20"
                                        : surveyItem.compliance === "partial"
                                          ? "bg-yellow-500/20"
                                          : "bg-red-500/20"
                                    }`}
                                  >
                                    {getComplianceIcon(surveyItem.compliance)}
                                  </div>
                                  <span className="font-semibold text-sm">
                                    {item.label}
                                  </span>
                                </div>
                                <div className="flex gap-1 mt-2 ml-11">
                                  {item.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex rounded-full overflow-hidden border-2 border-border/30">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCompliance(surveyItem, "compliant")
                                  }
                                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                                    surveyItem.compliance === "compliant"
                                      ? "bg-green-600 text-white"
                                      : "bg-background hover:bg-green-50 text-muted-foreground hover:text-green-600"
                                  }`}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Compliant
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCompliance(surveyItem, "partial")
                                  }
                                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-l ${
                                    surveyItem.compliance === "partial"
                                      ? "bg-yellow-500 text-white"
                                      : "bg-background hover:bg-yellow-50 text-muted-foreground hover:text-yellow-600 border-l-border/30"
                                  }`}
                                >
                                  <MinusCircle className="h-4 w-4" />
                                  Partial
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCompliance(
                                      surveyItem,
                                      "non_compliant",
                                    )
                                  }
                                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-l ${
                                    surveyItem.compliance === "non_compliant"
                                      ? "bg-red-600 text-white"
                                      : "bg-background hover:bg-red-50 text-muted-foreground hover:text-red-600 border-l-border/30"
                                  }`}
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  Non Compliant
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 ml-11">
                              <Textarea
                                placeholder="Add notes..."
                                value={surveyItem.notes || ""}
                                onChange={(e) =>
                                  updateNotes(surveyItem, e.target.value)
                                }
                                className="min-h-[60px] text-sm bg-background/50"
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Navigation */}
          <div className="px-8 py-4 pb-0 -mb-2 bg-background border-t border-border/50 flex justify-between items-center shrink-0">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="rounded-full font-semibold px-8"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>

            <Button
              type="button"
              size="lg"
              onClick={() =>
                setCurrentStep((prev) => Math.min(facilities.length, prev + 1))
              }
              disabled={currentStep === facilities.length}
              className="rounded-full font-semibold px-10 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
