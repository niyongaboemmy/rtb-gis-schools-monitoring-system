import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Box,
  Building2,
  Calendar,
  ClipboardCheck,
  Clock,
  Coffee,
  Droplets,
  FlaskConical,
  Globe,
  GraduationCap,
  GraduationCap as TeacherIcon,
  Home,
  Image as LucideImage,
  Layers,
  Mail,
  Map as LucideMap,
  MapIcon,
  MapPin,
  Maximize,
  Minus,
  Monitor,
  Plus,
  Pencil,
  Phone,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  Wifi,
  Wrench,
  XCircle,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PageHeader } from "../components/ui/page-header";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { SchoolForm } from "../components/SchoolForm";
import { FacilitySurveyForm } from "../components/FacilitySurveyForm";
import { Modal } from "../components/ui/modal";

type BuildingCondition = "good" | "fair" | "poor" | "critical";
// type PriorityLevel = "critical" | "high" | "medium" | "low";

export default function SchoolDecisionDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [is3DViewOpen, setIs3DViewOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [activeMapTab, setActiveMapTab] = useState<
    "map" | "satellite" | "terrain" | "traffic" | "street" | "kml"
  >("kml");
  const [facilitySurvey, setFacilitySurvey] = useState<any[]>([]);
  const [facilitiesList, setFacilitiesList] = useState<any[]>([]);
  const [selectedFacilityGroup, setSelectedFacilityGroup] = useState<any>(null);
  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);

  const lastFetchedId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (lastFetchedId.current === id) return;

    const fetchSchool = async () => {
      setLoading(true);
      try {
        // Fetch school (buildings, assessments included by default)
        const response = await api.get(`/schools/${id}`);
        const schoolData = response.data;

        // Calculate dynamic assessment data - do calculation even without buildings
        if (
          schoolData.buildings ||
          schoolData.educationPrograms ||
          schoolData.roadStatusPercentage
        ) {
          const currentYear = new Date().getFullYear();

          // Calculate average building age (if buildings exist)
          let avgBuildingAge = 0;
          let totalDepreciation = 0;
          let buildingAgeScore = 50;

          if (schoolData.buildings && schoolData.buildings.length > 0) {
            const buildingAges = schoolData.buildings
              .filter((b: any) => b.yearBuilt)
              .map((b: any) => currentYear - parseFloat(String(b.yearBuilt)));
            avgBuildingAge =
              buildingAges.length > 0
                ? Math.round(
                    buildingAges.reduce((a: number, b: number) => a + b, 0) /
                      buildingAges.length,
                  )
                : 0;

            // Calculate depreciation based on age and condition
            // Standard depreciation: 2% per year, max 60%
            // Condition adjustments: good=0, fair=10%, poor=20%, critical=30%
            const conditionPenalties: Record<string, number> = {
              good: 0,
              fair: 10,
              poor: 20,
              critical: 30,
            };

            const avgConditionPenalty =
              schoolData.buildings.reduce((sum: number, b: any) => {
                return sum + (conditionPenalties[b.condition] || 10);
              }, 0) / schoolData.buildings.length;

            const ageDepreciation = Math.min(avgBuildingAge * 2, 60);
            totalDepreciation = Math.min(
              ageDepreciation + avgConditionPenalty,
              100,
            );

            buildingAgeScore = Math.max(0, 100 - totalDepreciation);
          }

          // Infrastructure: calculate average of all infrastructure items
          // Boolean facilities convert to 100 if present, 0 if not
          const infrastructureItems = [
            schoolData.hasLibrary ? 100 : 0,
            schoolData.hasLaboratory ? 100 : 0,
            schoolData.hasComputerLab ? 100 : 0,
            schoolData.hasSportsField ? 100 : 0,
            schoolData.hasHostel ? 100 : 0,
            schoolData.hasCanteen ? 100 : 0,
            schoolData.hasElectricity ? 100 : 0,
            schoolData.hasWater ? 100 : 0,
            schoolData.hasInternet ? 100 : 0,
            schoolData.hasSolarPanel ? 100 : 0,
            parseFloat(String(schoolData.roadStatusPercentage)) || 0,
          ];
          const infrastructureScore =
            schoolData.buildings?.length > 0 ||
            infrastructureItems.some((v) => v > 0)
              ? Math.round(
                  infrastructureItems.reduce((a, b) => a + b, 0) /
                    infrastructureItems.length,
                )
              : 0;

          // Calculate population: students from trades + staff
          const totalStudentsInPrograms =
            schoolData.educationPrograms?.reduce(
              (sum: number, p: any) =>
                sum + (parseFloat(String(p.totalStudents)) || 0),
              0,
            ) || 0;
          const totalStaff =
            (parseFloat(String(schoolData.maleTeachers)) || 0) +
            (parseFloat(String(schoolData.femaleTeachers)) || 0) +
            (parseFloat(String(schoolData.maleAdminStaff)) || 0) +
            (parseFloat(String(schoolData.femaleAdminStaff)) || 0) +
            (parseFloat(String(schoolData.maleSupportStaff)) || 0) +
            (parseFloat(String(schoolData.femaleSupportStaff)) || 0);
          const totalPopulation = totalStudentsInPrograms + totalStaff;

          // Total capacity from trades
          const totalCapacity =
            schoolData.educationPrograms?.reduce(
              (sum: number, p: any) =>
                sum + (parseFloat(String(p.capacity)) || 0),
              0,
            ) || 0;

          // Population: students from trades (not staff)
          // For scoring: use students capacity utilization (students / capacity)
          const populationScore =
            totalCapacity > 0 && totalStudentsInPrograms > 0
              ? Math.min(
                  100,
                  Math.round((totalStudentsInPrograms / totalCapacity) * 100),
                )
              : 50;

          // Population pressure for display (capacity utilization)
          const populationPressure = populationScore;

          // Accessibility: use roads status percentage
          const accessibilityScore = schoolData.roadStatusPercentage || 50;

          // Facility Compliance: calculate from facility survey data
          const facilityComplianceRate = facilityStats?.complianceRate || 0;

          // Calculate overall score as weighted average of all 5 components
          // Weights: Infrastructure 25%, Building Health 25%, Population 20%, Accessibility 15%, Facility Compliance 15%
          const overallScore = Math.round(
            infrastructureScore * 0.2 +
              buildingAgeScore * 0.2 +
              populationScore * 0.2 +
              accessibilityScore * 0.2 +
              facilityComplianceRate * 0.2,
          );

          // Add calculated assessment to school data
          schoolData.calculatedAssessment = {
            infrastructureScore: infrastructureScore,
            buildingAgeScore: buildingAgeScore,
            depreciation: totalDepreciation,
            populationPressureScore: populationPressure,
            accessibilityScore: accessibilityScore,
            facilityComplianceScore: facilityComplianceRate,
            overallScore: overallScore,
            averageBuildingAge: avgBuildingAge,
            totalCapacity: totalCapacity,
            totalStudents: totalStudentsInPrograms,
            totalStaff: totalStaff,
            totalPopulation: totalPopulation,
            supportStaff:
              (parseFloat(String(schoolData.maleSupportStaff)) || 0) +
              (parseFloat(String(schoolData.femaleSupportStaff)) || 0),
          };
        }

        setSchool({ ...schoolData });

        // Fetch facility survey data if school exists
        if (id) {
          try {
            const surveyRes = await api.get(`/schools/${id}/survey`);
            setFacilitySurvey(surveyRes.data || []);
          } catch (surveyError) {
            console.log("No facility survey found for this school");
            setFacilitySurvey([]);
          }

          // Also fetch facilities list for displaying facility names
          try {
            const facilitiesRes = await api.get("/schools/facilities");
            setFacilitiesList(facilitiesRes.data || []);
          } catch (facilitiesError) {
            console.log("No facilities found");
            setFacilitiesList([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch school data", error);
      } finally {
        setLoading(false);
      }
    };

    lastFetchedId.current = id;
    fetchSchool();
  }, [id]);

  // Merge real data with dummy data structure
  const schoolData = school;

  // Calculate derived values from trades (real data)
  const educationPrograms = schoolData?.educationPrograms || [];
  const totalStudents =
    educationPrograms.length > 0
      ? educationPrograms.reduce(
          (sum: number, p: any) =>
            sum + (parseFloat(String(p.totalStudents)) || 0),
          0,
        )
      : 0;

  const totalCapacity =
    educationPrograms.length > 0
      ? educationPrograms.reduce(
          (sum: number, p: any) => sum + (parseFloat(String(p.capacity)) || 0),
          0,
        )
      : 0; // Fallback

  // All staff (teachers + admin + support)
  const maleTeachers = parseFloat(String(schoolData?.maleTeachers)) || 0;
  const femaleTeachers = parseFloat(String(schoolData?.femaleTeachers)) || 0;

  // Gender breakdown for staff
  const maleAdminStaff = parseFloat(String(schoolData?.maleAdminStaff)) || 0;
  const femaleAdminStaff =
    parseFloat(String(schoolData?.femaleAdminStaff)) || 0;
  const maleSupportStaff =
    parseFloat(String(schoolData?.maleSupportStaff)) || 0;
  const femaleSupportStaff =
    parseFloat(String(schoolData?.femaleSupportStaff)) || 0;

  const totalTeachers = maleTeachers + femaleTeachers;
  const totalAdminStaff = maleAdminStaff + femaleAdminStaff; // Total admin staff (male + female)
  const totalSupportStaff = maleSupportStaff + femaleSupportStaff; // Total support staff (male + female)
  const totalStaff = totalTeachers + totalAdminStaff + totalSupportStaff;

  // Facility survey calculations
  const getFacilitySurveyStats = () => {
    if (!facilitySurvey || facilitySurvey.length === 0) {
      return {
        compliant: 0,
        partial: 0,
        nonCompliant: 0,
        total: 0,
        complianceRate: 0,
        byFacility: [],
      };
    }

    const compliant = facilitySurvey.filter(
      (s: any) => s.compliance === "compliant",
    ).length;
    const partial = facilitySurvey.filter(
      (s: any) => s.compliance === "partial",
    ).length;
    const nonCompliant = facilitySurvey.filter(
      (s: any) => s.compliance === "non_compliant",
    ).length;
    const total = facilitySurvey.length;
    const complianceRate =
      total > 0 ? Math.round((compliant / total) * 100) : 0;

    // Group by facilityId for detailed breakdown
    const byFacilityMap: Record<string, { facility: string; items: any[] }> =
      {};
    facilitySurvey.forEach((survey: any) => {
      if (!byFacilityMap[survey.facilityId]) {
        const facilityInfo = facilitiesList.find(
          (f: any) => f.facilityId === survey.facilityId,
        );
        byFacilityMap[survey.facilityId] = {
          facility: facilityInfo?.title || survey.facilityId,
          items: [],
        };
      }
      // Find item name
      const facilityInfo = facilitiesList.find(
        (f: any) => f.facilityId === survey.facilityId,
      );
      const itemInfo = facilityInfo?.items?.find(
        (i: any) => i.id === survey.itemId,
      );
      byFacilityMap[survey.facilityId].items.push({
        ...survey,
        itemName: itemInfo?.label || survey.itemId,
      });
    });

    return {
      compliant,
      partial,
      nonCompliant,
      total,
      complianceRate,
      byFacility: Object.values(byFacilityMap),
    };
  };

  const facilityStats = getFacilitySurveyStats();

  const buildings = schoolData?.buildings || [];

  // Calculate average building year
  const buildingsWithYear = buildings.filter((b: any) => b.yearBuilt);
  const avgBuildingYear =
    buildingsWithYear.length > 0
      ? Math.round(
          buildingsWithYear.reduce(
            (sum: number, b: any) => sum + parseFloat(String(b.yearBuilt)),
            0,
          ) / buildingsWithYear.length,
        )
      : 0;

  // Calculate priority level based on Building Condition and Roof Condition
  const getPriorityFromBuildings = () => {
    if (!buildings || buildings.length === 0) return "medium";

    const conditionScores: Record<string, number> = {
      good: 0,
      fair: 25,
      poor: 50,
      critical: 75,
    };
    const roofScores: Record<string, number> = {
      good: 0,
      needs_repair: 15,
      damaged: 35,
    };

    const avgBuildingScore =
      buildings.reduce((sum: number, b: any) => {
        return sum + (conditionScores[b.condition] || 25);
      }, 0) / buildings.length;

    const avgRoofScore =
      buildings.reduce((sum: number, b: any) => {
        return sum + (roofScores[b.roofCondition] || 15);
      }, 0) / buildings.length;

    const totalScore = avgBuildingScore + avgRoofScore;

    if (totalScore >= 75) return "critical";
    if (totalScore >= 50) return "high";
    if (totalScore >= 25) return "medium";
    return "low";
  };

  const priorityLevel = getPriorityFromBuildings();

  // Use calculated assessment from real data, or fallback to API assessment, or dummy data
  const getAssessment = () => {
    if (schoolData?.calculatedAssessment) {
      // Recalculate with latest facilityStats
      const facilityComplianceRate = facilityStats?.complianceRate || 0;
      const infrastructureScore =
        schoolData.calculatedAssessment.infrastructureScore || 0;
      const buildingAgeScore =
        schoolData.calculatedAssessment.buildingAgeScore || 0;
      const populationScore =
        schoolData.calculatedAssessment.populationPressureScore || 0;
      const accessibilityScore =
        schoolData.calculatedAssessment.accessibilityScore || 0;

      const overallScore = Math.round(
        infrastructureScore * 0.2 +
          buildingAgeScore * 0.2 +
          populationScore * 0.2 +
          accessibilityScore * 0.2 +
          facilityComplianceRate * 0.2,
      );

      return {
        ...schoolData.calculatedAssessment,
        facilityComplianceScore: facilityComplianceRate,
        overallScore: overallScore,
        // Use building/roof condition-based priority level instead of score-based
        priorityLevel: priorityLevel,
        recommendations: [
          schoolData.calculatedAssessment.depreciation > 40
            ? "Consider building renovation due to high depreciation"
            : null,
          schoolData.calculatedAssessment.populationPressureScore > 80
            ? "Population pressure is high - consider expansion"
            : null,
          schoolData.calculatedAssessment.infrastructureScore < 50
            ? "Infrastructure needs immediate attention"
            : null,
        ].filter(Boolean),
        estimatedBudgetRwf:
          schoolData.calculatedAssessment.depreciation * 5000000,
        urgencyMonths: Math.max(1, Math.round((100 - overallScore) / 10)),
      };
    }
    if (schoolData?.assessments && schoolData.assessments.length > 0) {
      const latestAssessment = schoolData.assessments[0];
      return {
        ...latestAssessment,
        depreciation: Math.round(
          100 - (latestAssessment.buildingAgeScore || 50),
        ),
        priorityLevel: priorityLevel,
      };
    }
    return {
      priorityLevel: priorityLevel,
    };
  };

  const assessment = getAssessment();

  const getConditionColor = (condition: BuildingCondition | string) => {
    switch (condition) {
      case "good":
        return "bg-emerald-500";
      case "fair":
        return "bg-amber-500";
      case "poor":
        return "bg-red-500";
      case "critical":
        return "bg-red-700";
      default:
        return "bg-gray-500";
    }
  };

  const getConditionBg = (condition: BuildingCondition | string) => {
    switch (condition) {
      case "good":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
      case "fair":
        return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
      case "poor":
        return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
      case "critical":
        return "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  // const getPriorityBadge = (priority: PriorityLevel | string) => {
  //   switch (priority) {
  //     case "critical":
  //       return (
  //         <Badge
  //           variant="destructive"
  //           className="rounded-full font-black text-xs"
  //         >
  //           CRITICAL
  //         </Badge>
  //       );
  //     case "high":
  //       return (
  //         <Badge className="rounded-full font-black text-xs bg-amber-500 hover:bg-amber-600">
  //           HIGH
  //         </Badge>
  //       );
  //     case "medium":
  //       return (
  //         <Badge variant="outline" className="rounded-full font-black text-xs">
  //           MEDIUM
  //         </Badge>
  //       );
  //     case "low":
  //       return (
  //         <Badge className="rounded-full font-black text-xs bg-emerald-500 hover:bg-emerald-600">
  //           LOW
  //         </Badge>
  //       );
  //     default:
  //       return (
  //         <Badge variant="outline" className="rounded-full font-black text-xs">
  //           N/A
  //         </Badge>
  //       );
  //   }
  // };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "--";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const calculateAge = (year: number | undefined) => {
    if (!year) return "--";
    return new Date().getFullYear() - year;
  };

  const CustomZoomControls = () => {
    const map = useMap();
    return (
      <div className="absolute top-3 right-3 z-1001 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="w-8 h-8 rounded-xl bg-background/80 backdrop-blur-md border border-border/20 shadow-lg hover:bg-background transition-all"
          onClick={() => map.zoomIn()}
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="w-8 h-8 rounded-xl bg-background/80 backdrop-blur-md border border-border/20 shadow-lg hover:bg-background transition-all"
          onClick={() => map.zoomOut()}
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: "custom-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-center; width: 24px; height: 24px;">
          <div style="position: absolute; width: 100%; height: 100%; background-color: ${color}; border-radius: 50%; opacity: 0.4; animation: pin-pulse 2s infinite ease-out;"></div>
          <div style="position: relative; width: 14px; height: 14px; background-color: ${color}; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3); margin: auto;"></div>
          <style>
            @keyframes pin-pulse {
              0% { transform: scale(0.5); opacity: 0.8; }
              100% { transform: scale(2.5); opacity: 0; }
            }
          </style>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-xs font-black uppercase tracking-widest animate-pulse text-muted-foreground">
          Loading Decision Intelligence...
        </p>
      </div>
    );
  }

  if (!schoolData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive/50 mb-2" />
        <h2 className="text-2xl font-bold">School Not Found</h2>
        <p className="text-muted-foreground text-sm">
          The school could not be loaded.
        </p>
        <Button asChild className="rounded-full mt-4" variant="outline">
          <Link to="/schools">Return to Directory</Link>
        </Button>
      </div>
    );
  }

  const schoolPos: [number, number] = [
    parseFloat(String(schoolData.latitude)) || 0,
    parseFloat(String(schoolData.longitude)) || 0,
  ];

  // Use the values already computed above

  return (
    <>
      {!isSurveyModalOpen && (
        <div className="space-y-6 pb-10">
          {/* Header */}
          <PageHeader
            backButton={
              <Button
                variant="outline"
                size="icon"
                asChild
                className="rounded-full h-12 w-12 border-border/10 hover:bg-background/50 hover:border-primary/30 transition-all shadow-none"
              >
                <Link to="/schools">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            }
            title={schoolData.name}
            titleBadge={
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full uppercase text-[10px] font-black px-3 py-0.5 border-primary/20 text-primary bg-primary/5 shadow-none"
                >
                  {schoolData.type}
                </Badge>
                <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  ID: {schoolData.code}
                </span>
              </div>
            }
            description={
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                <Globe className="w-3.5 h-3.5 text-primary/40" />
                {schoolData.province} • {schoolData.district} •{" "}
                {schoolData.sector}
              </span>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {(schoolData.buildings?.some((b: any) => b.modelPath) ||
                  schoolData.kmzFilePath) && (
                  <Button
                    variant="outline"
                    onClick={() => id && navigate(`/schools/${id}/3dview`)}
                    className="rounded-full h-10 px-5 font-black uppercase text-[10px] border-primary/30 bg-primary/5 text-primary shadow-none hover:bg-primary/10 tracking-widest transition-all outline-none"
                  >
                    <Box className="mr-2 h-3.5 w-3.5" />
                    School Map
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(true)}
                  className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/10 shadow-none hover:bg-primary/5 transition-all"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsSurveyModalOpen(true)}
                  className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/10 shadow-none hover:bg-primary/5 transition-all"
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Survey
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/10 shadow-none hover:bg-primary/5 transition-all"
                >
                  <Link to={`/schools/${id}/kmz`}>
                    <Layers className="mr-2 h-4 w-4" />
                    KMZ/KML
                  </Link>
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-3 gap-3 w-full">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="col-span-2"
            >
              <Card className="border border-border/20 dark:border-blue-900/50 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-border/10 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Decision Intelligence Score
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="rounded-full bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black px-3"
                    >
                      Dynamic Analysis
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden">
                  <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/10">
                    {/* Hero Score Section */}
                    <div className="lg:w-2/5 p-8 flex flex-col items-center justify-center bg-linear-to-br from-primary/5 via-transparent to-transparent">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15, delay: 0.6 }}
                        className="relative w-48 h-48"
                      >
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="none"
                            className="text-muted/10"
                          />
                          <motion.circle
                            initial={{ pathLength: 0 }}
                            animate={{
                              pathLength: (assessment.overallScore ?? 50) / 100,
                            }}
                            transition={{
                              duration: 1.5,
                              ease: "easeOut",
                              delay: 0.8,
                            }}
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            className={cn(
                              assessment.overallScore >= 70
                                ? "text-emerald-500"
                                : assessment.overallScore >= 50
                                  ? "text-amber-500"
                                  : "text-red-500",
                            )}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                            className="text-5xl font-black tracking-tight"
                          >
                            {assessment.overallScore ?? 50}
                          </motion.span>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.4 }}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1"
                          >
                            Overall Score
                          </motion.span>
                        </div>

                        {/* Animated Glow Effect */}
                        <div
                          className={cn(
                            "absolute -inset-4 rounded-full opacity-20 blur-2xl -z-10 animate-pulse",
                            assessment.overallScore >= 70
                              ? "bg-emerald-500"
                              : assessment.overallScore >= 50
                                ? "bg-amber-500"
                                : "bg-red-500",
                          )}
                        />
                      </motion.div>

                      <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                        <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                            Status
                          </p>
                          <Badge
                            className={cn(
                              "rounded-full font-black text-[10px] uppercase",
                              assessment.overallScore >= 70
                                ? "bg-emerald-500"
                                : assessment.overallScore >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                          >
                            {assessment.overallScore >= 70
                              ? "Optimal"
                              : assessment.overallScore >= 50
                                ? "Acceptable"
                                : "Critical"}
                          </Badge>
                        </div>
                        <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                            Urgency
                          </p>
                          <p className="text-sm font-black text-primary uppercase leading-tight">
                            {assessment.urgencyMonths} Months
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Section */}
                    <div className="lg:w-3/5 p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            label: "Buildings Health",
                            score: assessment.infrastructureScore ?? 50,
                            icon: Building2,
                          },
                          {
                            label: "Buildings Depreciation",
                            score: assessment.buildingAgeScore ?? 50,
                            icon: TrendingUp,
                          },
                          {
                            label: "Students Population",
                            score: assessment.populationPressureScore ?? 50,
                            icon: Users,
                          },
                          {
                            label: "School Accessibility",
                            score: assessment.accessibilityScore ?? 50,
                            icon: MapPin,
                          },
                          {
                            label: "Facility Compliance",
                            score: assessment.facilityComplianceScore ?? 0,
                            icon: ClipboardCheck,
                          },
                        ].map((metric, index) => (
                          <motion.div
                            key={metric.label}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * index + 0.5 }}
                            whileHover={{
                              scale: 1.02,
                              backgroundColor: "rgba(var(--primary), 0.05)",
                            }}
                            className="p-3 rounded-2xl bg-muted/30 border border-border/5 transition-all group cursor-default"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 rounded-lg bg-background dark:bg-blue-900/20 shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <metric.icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-sm font-bold text-muted-foreground dark:text-white group-hover:text-foreground transition-colors">
                                {metric.label}
                              </span>
                            </div>
                            <div className="flex items-end justify-between gap-2">
                              <span className="text-lg font-black leading-none">
                                {metric.score}%
                              </span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${metric.score}%` }}
                                  transition={{
                                    duration: 1,
                                    delay: 0.8 + index * 0.1,
                                  }}
                                  className={cn(
                                    "h-full rounded-full",
                                    metric.score >= 70
                                      ? "bg-emerald-500"
                                      : metric.score >= 50
                                        ? "bg-amber-500"
                                        : "bg-red-500",
                                  )}
                                />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Enhanced Recommendations */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                        className="p-5 bg-card/40 border border-border/10 rounded-3xl backdrop-blur-md"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-black text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
                            <Sparkles className="w-3.5 h-3.5" />
                            Intelligence Suggestions
                          </h4>
                          <Badge
                            variant="outline"
                            className="rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20"
                          >
                            Live Analysis
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {assessment.recommendations
                            ?.slice(0, 4)
                            .map((rec: string, i: number) => {
                              const isUrgent = rec.includes("[URGENT]");
                              const isCritical = rec.includes("[CRITICAL]");
                              const isStrategic = rec.includes("[STRATEGIC]");
                              const cleanRec = rec
                                .replace("[URGENT]", "")
                                .replace("[CRITICAL]", "")
                                .replace("[STRATEGIC]", "")
                                .trim();

                              return (
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 1.3 + i * 0.1 }}
                                  key={i}
                                  className={cn(
                                    "flex items-start gap-4 p-3.5 rounded-2xl border transition-all hover:scale-[1.01]",
                                    isUrgent
                                      ? "bg-red-500/5 border-red-500/20 shadow-red-500/5"
                                      : isCritical
                                        ? "bg-amber-500/5 border-amber-500/20 shadow-amber-500/5"
                                        : isStrategic
                                          ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5"
                                          : "bg-primary/5 border-primary/20 shadow-primary/5",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "p-2 rounded-xl shrink-0",
                                      isUrgent
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                                        : isCritical
                                          ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                                          : isStrategic
                                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                            : "bg-primary text-white shadow-lg shadow-primary/30",
                                    )}
                                  >
                                    {isUrgent ? (
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    ) : isCritical ? (
                                      <Wrench className="w-3.5 h-3.5" />
                                    ) : isStrategic ? (
                                      <Sparkles className="w-3.5 h-3.5" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={cn(
                                          "text-[9px] font-black uppercase tracking-wider",
                                          isUrgent
                                            ? "text-red-500"
                                            : isCritical
                                              ? "text-amber-600"
                                              : isStrategic
                                                ? "text-emerald-600"
                                                : "text-primary",
                                        )}
                                      >
                                        {isUrgent
                                          ? "Urgent Refactor"
                                          : isCritical
                                            ? "Critical Need"
                                            : isStrategic
                                              ? "Strategic Goal"
                                              : "System Note"}
                                      </span>
                                      <div
                                        className={cn(
                                          "h-1 w-1 rounded-full",
                                          isUrgent
                                            ? "bg-red-500"
                                            : isCritical
                                              ? "bg-amber-500"
                                              : isStrategic
                                                ? "bg-emerald-500"
                                                : "bg-primary",
                                        )}
                                      />
                                    </div>
                                    <p className="text-xs font-bold leading-relaxed text-foreground/90">
                                      {cleanRec}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            {/* Location Map */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className=""
            >
              <Card className="border border-border/20 dark:border-blue-900/50 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-border/10 pb-2 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2 pr-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      {/* KMZ Status Badge */}
                      <span>Location</span>
                    </CardTitle>
                    {/* Map Tabs */}
                    <div className="flex bg-muted/50 rounded-xl p-1">
                      <button
                        onClick={() => setActiveMapTab("kml")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          activeMapTab === "kml"
                            ? "bg-primary text-white shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LucideImage className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">KML</span>
                      </button>
                      <button
                        onClick={() => setActiveMapTab("map")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          activeMapTab === "map"
                            ? "bg-primary text-white shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LucideMap className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Map</span>
                      </button>
                      <button
                        onClick={() => setActiveMapTab("satellite")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          activeMapTab === "satellite"
                            ? "bg-primary text-white shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Satellite</span>
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Map Content */}
                  {activeMapTab !== "kml" ? (
                    <div className="h-[400px] md:h-[400px] w-full relative">
                      <MapContainer
                        center={schoolPos}
                        zoom={activeMapTab === "street" ? 16 : 14}
                        className="w-full h-full"
                        zoomControl={false}
                      >
                        {activeMapTab === "map" && (
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          />
                        )}
                        {activeMapTab === "satellite" && (
                          <TileLayer
                            attribution="&copy; Esri"
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          />
                        )}
                        {activeMapTab === "terrain" && (
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                          />
                        )}
                        {activeMapTab === "traffic" && (
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                        )}
                        {activeMapTab === "street" && (
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                        )}
                        {/* Custom Zoom Controls */}
                        <CustomZoomControls />

                        <Marker
                          position={schoolPos}
                          icon={createCustomIcon("#3b82f6")}
                          eventHandlers={{
                            click: () => setIs3DViewOpen(true),
                          }}
                        >
                          <Popup closeButton={false} className="custom-popup">
                            <div className="p-1">
                              <div className="font-black text-xs mb-0.5 text-primary">
                                {schoolData.name}
                              </div>
                              <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                <Box className="w-3 h-3" />
                                Click to view school map
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>

                      {/* Modern Overlays */}
                      <div className="absolute top-3 left-3 z-1001 bg-background/80 backdrop-blur-md border border-border/20 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Live Monitoring
                        </span>
                      </div>

                      <div className="absolute bottom-3 right-3 z-1001 bg-background/80 backdrop-blur-md border border-border/20 rounded-xl px-3 py-1.5 shadow-lg flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-tighter">
                          Location Context
                        </span>
                        <span className="text-[11px] font-bold tabular-nums">
                          {schoolPos[0].toFixed(5)}°, {schoolPos[1].toFixed(5)}°
                        </span>
                      </div>

                      {/* 3D View Overlay Hint */}
                      <div className="absolute bottom-3 left-3 z-1001">
                        <Button
                          size="sm"
                          onClick={() =>
                            id && navigate(`/schools/${id}/3dview`)
                          }
                          className="rounded-full shadow-lg bg-primary/90 hover:bg-primary text-[10px] font-black uppercase border border-white/20 h-8 px-4"
                        >
                          <Box className="w-3.5 h-3.5 mr-2" />
                          Explore 3D
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* KML / Structure Photo Tab */
                    <div className="h-[400px] md:h-[400px] w-full relative bg-muted/20">
                      {/* Show processing status if KMZ is being processed */}
                      {schoolData.kmzStatus === "processing" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                          <p className="text-sm font-bold text-muted-foreground mb-2">
                            Processing KMZ file...
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            Please wait while we extract building structures
                          </p>
                        </div>
                      ) : (schoolData.kmzStatus === "completed" ||
                          schoolData.kmzStatus === "pending") &&
                        id ? (
                        <div
                          className="w-full h-full relative group cursor-pointer"
                          onClick={() =>
                            id && navigate(`/schools/${id}/3dview`)
                          }
                        >
                          <img
                            src={`/public/uploads/schools/${id}/kmz_content/b0.png`}
                            alt="School Structure"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              if (img.src.includes("b0.png")) {
                                img.src = `/public/uploads/schools/${id}/kmz_content/model.jpg`;
                              } else if (img.src.includes("model.jpg")) {
                                img.src = `/public/uploads/schools/${id}/kmz_content/a.png`;
                              } else if (img.src.includes("a.png")) {
                                img.src = `/public/uploads/schools/${id}/kmz_content/b2.png`;
                              } else {
                                img.src =
                                  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Qzk2QTkiIGZvbnQtd2lkdGg9IjE2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zdHlsZT0iYm9sZCI+T0xEIFNBTVBMRTwvdGV4dD48L3N2Zz4=";
                              }
                            }}
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="font-bold text-sm">
                              Click to view full school map
                            </p>
                          </div>
                          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              asChild
                              className="rounded-full bg-white/90 hover:bg-white dark:bg-gray-800 dark:text-white dark:hover:bg-blue-600 text-foreground shadow-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link to={`/schools/${id}/kmz`}>
                                <Upload className="w-4 h-4 mr-1" />
                                Update
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-full bg-primary/90 hover:bg-primary text-white shadow-lg"
                            >
                              <Box className="w-4 h-4 mr-1" />
                              School Map
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                          <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-4">
                            <LucideImage className="w-10 h-10 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm font-bold text-muted-foreground mb-2">
                            No structure image available
                          </p>
                          <p className="text-xs text-muted-foreground/70 mb-4">
                            Upload KMZ to see school structure
                          </p>
                          <Button size="sm" asChild className="rounded-full">
                            <Link to={`/schools/${id}/kmz`}>
                              <Upload className="w-4 h-4 mr-1" />
                              Upload KMZ
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coordinates Info - Always Visible */}
                  <div className="p-3 sm:p-4 border-t border-border/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Latitude</span>
                        <span className="font-mono font-bold text-xs">
                          {parseFloat(String(schoolData.latitude)).toFixed(6)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Longitude</span>
                        <span className="font-mono font-bold text-xs">
                          {parseFloat(String(schoolData.longitude)).toFixed(6)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Elevation</span>
                        <span className="font-mono font-bold text-xs">
                          {parseFloat(String(schoolData.elevation)) || 0} m
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Campus</span>
                        <span className="font-mono font-bold text-xs">
                          {schoolData.campusAreaHectares} ha
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            {/* Executive Summary Cards */}
          </div>

          {/* Main Grid - Infrastructure-Focused Layout (2/3 infra + 1/3 school info) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT + CENTRE: Infrastructure Column (spans 2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Infrastructure Health Overview ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="border border-border/20 bg-orange-50/50 dark:bg-blue-900/10 dark:border-blue-500/20 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 pt-5">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-orange-700 dark:text-orange-400 tracking-wider">
                      <Building2 className="w-5 h-5" />
                      <div className="dark:text-white">
                        Buildings Health Overview
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-7 pb-7">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        {
                          label: "Good State",
                          count: buildings.filter(
                            (b: any) => b.condition === "good",
                          ).length,
                          total: buildings.length,
                          colorClass: "text-emerald-500",
                          bgClass: "text-emerald-200 dark:text-emerald-900/40",
                          textClass: "text-emerald-700 dark:text-emerald-400",
                          labelClass:
                            "text-emerald-600/70 dark:text-emerald-500/70",
                          containerClass:
                            "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                        },
                        {
                          label: "Fair State",
                          count: buildings.filter(
                            (b: any) => b.condition === "fair",
                          ).length,
                          total: buildings.length,
                          colorClass: "text-amber-500",
                          bgClass: "text-amber-200 dark:text-amber-900/40",
                          textClass: "text-amber-700 dark:text-amber-400",
                          labelClass:
                            "text-amber-600/70 dark:text-amber-500/70",
                          containerClass:
                            "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                        },
                        {
                          label: "Need Repair",
                          count: buildings.filter(
                            (b: any) =>
                              b.condition === "poor" ||
                              b.condition === "critical",
                          ).length,
                          total: buildings.length,
                          colorClass: "text-red-500",
                          bgClass: "text-red-200 dark:text-red-900/40",
                          textClass: "text-red-700 dark:text-red-400",
                          labelClass: "text-red-600/70 dark:text-red-500/70",
                          containerClass:
                            "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                        },
                        {
                          label: "Utilities Online",
                          count: [
                            schoolData.hasElectricity,
                            schoolData.hasWater,
                            schoolData.hasInternet,
                            schoolData.hasSolarPanel,
                          ].filter(Boolean).length,
                          total: 4,
                          colorClass: "text-primary",
                          bgClass: "text-primary/20 dark:text-primary/10",
                          textClass: "text-primary dark:text-primary",
                          labelClass: "text-primary/70 dark:text-primary/70",
                          containerClass:
                            "bg-primary/5 dark:bg-primary/5 border-primary/20 dark:border-primary/20",
                        },
                      ].map((stat, idx) => {
                        const pct =
                          stat.total > 0
                            ? Math.round((stat.count / stat.total) * 100)
                            : 0;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-4 rounded-3xl border-2 text-center flex flex-col items-center justify-center",
                              stat.containerClass,
                            )}
                          >
                            <div className="relative w-20 h-20 mb-2">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="40"
                                  cy="40"
                                  r="35"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  fill="none"
                                  className={stat.bgClass}
                                />
                                <circle
                                  cx="40"
                                  cy="40"
                                  r="35"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  fill="none"
                                  strokeDasharray={`${(pct / 100) * 220} 220`}
                                  strokeLinecap="round"
                                  className={cn(
                                    "transition-all duration-1000",
                                    stat.colorClass,
                                  )}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                  className={cn(
                                    "text-lg font-black",
                                    stat.textClass,
                                  )}
                                >
                                  {pct}%
                                </span>
                              </div>
                            </div>
                            <p
                              className={cn(
                                "text-xl font-black leading-none mb-1",
                                stat.textClass,
                              )}
                            >
                              {stat.count}
                              {stat.label === "Utilities Online" && (
                                <span className="text-sm opacity-60">/4</span>
                              )}
                            </p>
                            <p
                              className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                stat.labelClass,
                              )}
                            >
                              {stat.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {assessment.infrastructureScore !== undefined && (
                      <div className="mt-5 pt-4 border-t border-blue-200/40 dark:border-blue-800/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black tracking-widest text-blue-700/70 dark:text-blue-400/70">
                            Overall Buildings Infrastructure Score
                          </span>
                          <span
                            className={cn(
                              "text-sm font-black px-3 py-1 rounded-full",
                              assessment.infrastructureScore >= 70
                                ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : assessment.infrastructureScore >= 50
                                  ? "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                                  : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400",
                            )}
                          >
                            {assessment.infrastructureScore}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-100 dark:bg-blue-950/40 rounded-full h-3">
                          <div
                            className={cn(
                              "h-3 rounded-full transition-all duration-1000",
                              assessment.infrastructureScore >= 70
                                ? "bg-emerald-500"
                                : assessment.infrastructureScore >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                            style={{
                              width: `${assessment.infrastructureScore}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/60">
                          <span>0 — Critical</span>
                          <span>50 — Moderate</span>
                          <span>100 — Excellent</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
              {/* Buildings & Infrastructure */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Card className="border border-border/20 bg-card/60 dark:border-blue-800/30 backdrop-blur-sm rounded-3xl">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      Buildings & Infrastructure Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/10">
                            <th className="text-left py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Building
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Condition
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Floors
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Area (m²)
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Built
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-black uppercase text-muted-foreground">
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {buildings.map((building: any, idx: number) => (
                            <tr
                              key={building.name || idx}
                              className="border-b border-border/5 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedBuilding(building);
                                setIsBuildingModalOpen(true);
                              }}
                            >
                              <td className="py-3 px-4">
                                <p className="font-bold text-sm">
                                  {building.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {building.function || "Educational"}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-black uppercase",
                                    getConditionBg(building.condition),
                                  )}
                                >
                                  {building.condition}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold">
                                {building.floors}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {formatNumber(building.areaSquareMeters)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="text-sm font-medium">
                                  {building.yearBuilt}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  ({calculateAge(building.yearBuilt)}y)
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-muted/50 rounded-full h-2">
                                    <div
                                      className={cn(
                                        "h-2 rounded-full",
                                        getConditionColor(building.condition),
                                      )}
                                      style={{
                                        width: `${building.structuralScore}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-black w-8">
                                    {building.structuralScore}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Building Summary */}
                    <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/10">
                      <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {
                            buildings.filter((b: any) => b.condition === "good")
                              .length
                          }
                        </p>
                        <p className="text-xs font-bold text-muted-foreground">
                          Good Condition
                        </p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl">
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                          {
                            buildings.filter((b: any) => b.condition === "fair")
                              .length
                          }
                        </p>
                        <p className="text-xs font-bold text-muted-foreground">
                          Fair Condition
                        </p>
                      </div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl">
                        <p className="text-2xl font-black text-red-600 dark:text-red-400">
                          {
                            buildings.filter(
                              (b: any) =>
                                b.condition === "poor" ||
                                b.condition === "critical",
                            ).length
                          }
                        </p>
                        <p className="text-xs font-bold text-muted-foreground">
                          Needs Attention
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Facility Survey — Primary Hero Card ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card className="border dark:bg-gray-900/40 border-border/20 dark:border-blue-800/30 bg-card rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-border/10 pb-4 pt-5">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-primary">
                      <ClipboardCheck className="w-6 h-6" />
                      <span className="dark:text-white">
                        Facility Overview Compliance Rate
                      </span>{" "}
                      <div className="px-3 py-1 rounded-full bg-blue-700 text-white text-sm">
                        {facilityStats.complianceRate}%
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {facilityStats.total > 0 ? (
                      <>
                        {/* Three Column Stats */}
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            {
                              label: "Compliant",
                              count: facilityStats.compliant,
                              colorClass: "text-emerald-500",
                              bgClass:
                                "text-emerald-200 dark:text-emerald-900/40",
                              textClass:
                                "text-emerald-700 dark:text-emerald-400",
                              labelClass: "text-emerald-600/70",
                              containerClass:
                                "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                            },
                            {
                              label: "Partial",
                              count: facilityStats.partial,
                              colorClass: "text-amber-500",
                              bgClass: "text-amber-200 dark:text-amber-900/40",
                              textClass: "text-amber-700 dark:text-amber-400",
                              labelClass: "text-amber-600/70",
                              containerClass:
                                "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                            },
                            {
                              label: "Non-Compliant",
                              count: facilityStats.nonCompliant,
                              colorClass: "text-red-500",
                              bgClass: "text-red-200 dark:text-red-900/40",
                              textClass: "text-red-700 dark:text-red-400",
                              labelClass: "text-red-600/70",
                              containerClass:
                                "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                            },
                          ].map((stat, idx) => {
                            const pct =
                              facilityStats.total > 0
                                ? Math.round(
                                    (stat.count / facilityStats.total) * 100,
                                  )
                                : 0;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "p-4 rounded-3xl border-2 text-center flex flex-col items-center justify-center",
                                  stat.containerClass,
                                )}
                              >
                                <div className="relative w-20 h-20 mb-2">
                                  <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="35"
                                      stroke="currentColor"
                                      strokeWidth="6"
                                      fill="none"
                                      className={stat.bgClass}
                                    />
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="35"
                                      stroke="currentColor"
                                      strokeWidth="6"
                                      fill="none"
                                      strokeDasharray={`${(pct / 100) * 220} 220`}
                                      strokeLinecap="round"
                                      className={cn(
                                        "transition-all duration-1000",
                                        stat.colorClass,
                                      )}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span
                                      className={cn(
                                        "text-lg font-black",
                                        stat.textClass,
                                      )}
                                    >
                                      {pct}%
                                    </span>
                                  </div>
                                </div>
                                <p
                                  className={cn(
                                    "text-xl font-black leading-none mb-1",
                                    stat.textClass,
                                  )}
                                >
                                  {stat.count}
                                </p>
                                <p
                                  className={cn(
                                    "text-[10px] font-black uppercase",
                                    stat.labelClass,
                                  )}
                                >
                                  {stat.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        {/* Total Items */}
                        <div className="text-center text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl">
                          <span className="font-bold">
                            {facilityStats.total}
                          </span>{" "}
                          facility items surveyed
                        </div>
                        {/* Detailed Facility Breakdown */}
                        {facilityStats.byFacility &&
                          facilityStats.byFacility.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-border/10">
                              <div className="flex items-center justify-between mb-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                                  Structural Facility Breakdown
                                </p>
                                <div className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
                                  Sorted by Compliance
                                </div>
                              </div>

                              <motion.div
                                initial="hidden"
                                animate="show"
                                variants={{
                                  hidden: { opacity: 0 },
                                  show: {
                                    opacity: 1,
                                    transition: {
                                      staggerChildren: 0.05,
                                    },
                                  },
                                }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                              >
                                {[...facilityStats.byFacility]
                                  .map((group: any) => {
                                    const compliant = group.items.filter(
                                      (i: any) => i.compliance === "compliant",
                                    ).length;
                                    const total = group.items.length;
                                    const rate =
                                      total > 0
                                        ? Math.round((compliant / total) * 100)
                                        : 0;
                                    return { ...group, rate, compliant, total };
                                  })
                                  .sort((a, b) => b.rate - a.rate)
                                  .map((facilityGroup, index) => {
                                    const FacilityIcon = (() => {
                                      const n =
                                        facilityGroup.facility.toLowerCase();
                                      if (n.includes("classroom"))
                                        return BookOpen;
                                      if (n.includes("library"))
                                        return BookOpen;
                                      if (
                                        n.includes("lab") ||
                                        n.includes("laboratory")
                                      )
                                        return FlaskConical;
                                      if (n.includes("computer"))
                                        return Monitor;
                                      if (n.includes("hostel")) return Home;
                                      if (n.includes("canteen")) return Coffee;
                                      if (
                                        n.includes("sports") ||
                                        n.includes("field")
                                      )
                                        return Trophy;
                                      if (
                                        n.includes("washroom") ||
                                        n.includes("toilet")
                                      )
                                        return Droplets;
                                      if (n.includes("water")) return Droplets;
                                      if (
                                        n.includes("electricity") ||
                                        n.includes("power")
                                      )
                                        return Zap;
                                      if (
                                        n.includes("internet") ||
                                        n.includes("wifi")
                                      )
                                        return Wifi;
                                      if (
                                        n.includes("security") ||
                                        n.includes("fence")
                                      )
                                        return Shield;
                                      return Building2;
                                    })();

                                    return (
                                      <motion.div
                                        key={facilityGroup.facility}
                                        variants={{
                                          hidden: { opacity: 0, y: 10 },
                                          show: { opacity: 1, y: 0 },
                                        }}
                                        whileHover={{
                                          scale: 1.01,
                                          translateY: -2,
                                        }}
                                        onClick={() => {
                                          setSelectedFacilityGroup(
                                            facilityGroup,
                                          );
                                          setIsFacilityModalOpen(true);
                                        }}
                                        className="p-4 rounded-2xl bg-muted/20 border border-border/5 hover:bg-muted/40 transition-all group cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="p-2 rounded-xl bg-background shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                                            <FacilityIcon className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs font-black truncate">
                                                {facilityGroup.facility}
                                              </span>
                                              <span
                                                className={cn(
                                                  "text-[10px] font-black tabular-nums",
                                                  facilityGroup.rate >= 70
                                                    ? "text-emerald-500"
                                                    : facilityGroup.rate >= 40
                                                      ? "text-amber-500"
                                                      : "text-red-500",
                                                )}
                                              >
                                                {facilityGroup.rate}%
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-1.5">
                                          <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{
                                                width: `${facilityGroup.rate}%`,
                                              }}
                                              transition={{
                                                duration: 1,
                                                delay: 0.2 + index * 0.05,
                                              }}
                                              className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                facilityGroup.rate >= 70
                                                  ? "bg-emerald-500"
                                                  : facilityGroup.rate >= 40
                                                    ? "bg-amber-500"
                                                    : "bg-red-500",
                                              )}
                                            />
                                          </div>
                                          <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                            <span>
                                              {facilityGroup.rate >= 70
                                                ? "Mainly Compliant"
                                                : facilityGroup.rate >= 40
                                                  ? "Partially Compliant"
                                                  : "Needs Attention"}
                                            </span>
                                            <span>
                                              {facilityGroup.total} Total
                                            </span>
                                          </div>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                              </motion.div>
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="text-center py-10 text-muted-foreground">
                        <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">
                          No Facility Survey Data
                        </p>
                        <p className="text-sm mt-2 mb-4">
                          Complete a facility survey to see compliance details
                        </p>
                        <Button
                          onClick={() => setIsSurveyModalOpen(true)}
                          className="rounded-full"
                        >
                          Start Facility Survey
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column - Summary & Other Info */}
            <div className="space-y-6">
              <div className="col-span-2 grid gap-4 grid-cols-12 w-full h-max">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-blue-50 dark:bg-blue-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">
                            Total Students
                          </p>
                          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                            {formatNumber(totalStudents)}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-600/70">
                        <TrendingUp className="w-3 h-3" />
                        <span>Capacity: {formatNumber(totalCapacity)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-blue-50 dark:bg-blue-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">
                            All Staff
                          </p>
                          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                            {formatNumber(totalStaff)}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                          <TeacherIcon className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-600/70">
                        <Target className="w-3 h-3" />
                        <span>
                          Gender Ratio (Male:Female):{" "}
                          {totalTeachers > 0
                            ? `${maleTeachers}:${femaleTeachers}`
                            : "N/A"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">
                            Buildings
                          </p>
                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                            {buildings.length}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-emerald-600" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-600/70">
                        <Activity className="w-3 h-3" />
                        <span>
                          Avg Year:{" "}
                          {avgBuildingYear > 0
                            ? avgBuildingYear
                            : parseFloat(String(schoolData.establishedYear))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                {/* Additional KPI Cards - Matching SchoolDetail */}
                {/* Single Land Usage Card - Shows Used vs Total */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-green-50 dark:bg-green-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-green-100/80 dark:hover:bg-green-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-green-600/70">
                            Land Usage (ha)
                          </p>
                          <p className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">
                            {schoolData.usedLandArea !== undefined
                              ? `${Math.round(parseFloat(String(schoolData.usedLandArea))) || 0} / ${Math.round((parseFloat(String(schoolData.usedLandArea)) || 0) + (parseFloat(String(schoolData.unusedLandArea)) || 0))}`
                              : "--"}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                      {/* Progress bar showing used vs total */}
                      {schoolData.usedLandArea !== undefined &&
                        schoolData.unusedLandArea !== undefined && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-green-600/70 mb-1">
                              <span>Used / Total</span>
                              <span>
                                {Math.round(
                                  (parseFloat(schoolData.usedLandArea) /
                                    (parseFloat(schoolData.usedLandArea ?? 0) +
                                      parseFloat(
                                        schoolData.unusedLandArea ?? 0,
                                      ))) *
                                    100,
                                )}
                                %
                              </span>
                            </div>
                            <div className="w-full bg-green-200 dark:bg-green-900/30 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-green-500 transition-all"
                                style={{
                                  width: `${Math.round(
                                    (parseFloat(schoolData.usedLandArea ?? 0) /
                                      (parseFloat(
                                        schoolData.usedLandArea ?? 0,
                                      ) +
                                        parseFloat(
                                          schoolData.unusedLandArea ?? 0,
                                        ))) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-[9px] text-green-600/50">
                              <span>
                                Used:{" "}
                                {parseFloat(String(schoolData.usedLandArea)) ||
                                  0}{" "}
                                ha
                              </span>
                              <span>
                                Available:{" "}
                                {parseFloat(
                                  String(schoolData.unusedLandArea),
                                ) || 0}{" "}
                                ha
                              </span>
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-slate-50 dark:bg-slate-950/30 rounded-2xl transition-all dark:border-blue-700/30 duration-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="mb-3">Road Status</div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600/70 dark:text-gray-300/50">
                            Accessibility
                          </p>
                          <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                            {schoolData.roadStatusPercentage
                              ? `${parseFloat(String(schoolData.roadStatusPercentage))}%`
                              : "--"}
                          </p>
                        </div>
                        <div>
                          <div className="w-12 h-12 bg-slate-500/20 rounded-2xl flex items-center justify-center">
                            <MapIcon className="w-6 h-6 text-slate-600" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="col-span-6"
                >
                  <Card className="border border-border/20 bg-teal-50 dark:bg-teal-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/70">
                            TVET Trades
                          </p>
                          <p className="text-2xl font-black text-teal-700 dark:text-teal-300 mt-1">
                            {schoolData.educationPrograms?.length || 0}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-teal-600" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-teal-600/70">
                        <span>
                          Total:{" "}
                          {formatNumber(
                            schoolData.calculatedAssessment?.totalCapacity || 0,
                          )}{" "}
                          capacity
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
              {/* Student Distribution - Using real trades from database */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="border border-border/20 bg-card/60 dark:border-blue-800/30 backdrop-blur-sm rounded-3xl">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
                      Student Distribution by Trade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {schoolData.educationPrograms &&
                    schoolData.educationPrograms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {schoolData.educationPrograms.map(
                          (program: any, index: number) => {
                            const pStudents =
                              parseFloat(String(program.totalStudents)) || 0;
                            const pCapacity =
                              parseFloat(String(program.capacity)) || 0;
                            const percentage =
                              pCapacity > 0
                                ? ((pStudents / pCapacity) * 100).toFixed(1)
                                : "0";
                            const colors = [
                              "bg-blue-500",
                              "bg-emerald-500",
                              "bg-amber-500",
                              "bg-blue-500",
                              "bg-cyan-500",
                              "bg-rose-500",
                              "bg-indigo-500",
                              "bg-teal-500",
                            ];
                            return (
                              <div
                                key={program.code || index}
                                className="p-4 bg-muted/30 rounded-2xl"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span
                                    className="text-xs font-bold text-muted-foreground truncate"
                                    title={program.name}
                                  >
                                    {program.name || program.code}
                                  </span>
                                  <span className="text-sm font-black">
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="w-full bg-muted/50 rounded-full h-2 mb-2">
                                  <div
                                    className={cn(
                                      "h-2 rounded-full transition-all",
                                      colors[index % colors.length],
                                    )}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center">
                                  <p className="text-sm font-black">
                                    {formatNumber(program.totalStudents || 0)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    cap: {formatNumber(program.capacity || 0)}
                                  </p>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No trades available</p>
                        <p className="text-xs mt-1">
                          Add programs to see student distribution
                        </p>
                      </div>
                    )}

                    {/* Show total summary */}
                    {schoolData.educationPrograms &&
                      schoolData.educationPrograms.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/10 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-muted-foreground">
                              Total Students
                            </p>
                            <p className="text-2xl font-black">
                              {formatNumber(
                                schoolData.calculatedAssessment
                                  ?.totalStudents ||
                                  schoolData.educationPrograms.reduce(
                                    (sum: number, p: any) =>
                                      sum +
                                      (parseFloat(String(p.totalStudents)) ||
                                        0),
                                    0,
                                  ),
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-muted-foreground">
                              Total Capacity
                            </p>
                            <p className="text-2xl font-black">
                              {formatNumber(
                                schoolData.calculatedAssessment
                                  ?.totalCapacity ||
                                  schoolData.educationPrograms.reduce(
                                    (sum: number, p: any) =>
                                      sum +
                                      (parseFloat(String(p.capacity)) || 0),
                                    0,
                                  ),
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Staff Distribution */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Card className="border border-border/20 bg-card/60 dark:border-blue-700/30 backdrop-blur-sm rounded-3xl">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Staff Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                          {formatNumber(
                            parseFloat(String(schoolData.maleTeachers)) || 0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Male Teachers
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                          {formatNumber(
                            parseFloat(String(schoolData.femaleTeachers)) || 0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Female Teachers
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-purple-600 dark:text-purple-400">
                          {formatNumber(
                            parseFloat(String(schoolData.maleAdminStaff)) || 0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Male Admin Staff
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-purple-600 dark:text-purple-400">
                          {formatNumber(
                            parseFloat(String(schoolData.femaleAdminStaff)) ||
                              0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Female Admin Staff
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-orange-600 dark:text-orange-400">
                          {formatNumber(
                            parseFloat(String(schoolData.maleSupportStaff)) ||
                              0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Male Support Staff
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl text-center">
                        <p className="text-3xl font-black text-orange-600 dark:text-orange-400">
                          {formatNumber(
                            parseFloat(String(schoolData.femaleSupportStaff)) ||
                              0,
                          )}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          Female Support Staff
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              {/* Right Column - 1/3 width */}
              <div className="space-y-6">
                {/* Contact Information */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <Card className="border border-border/20 bg-card/60 backdrop-blur-sm dark:border-blue-700/30 rounded-3xl">
                    <CardHeader className="border-b border-border/10 pb-4">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Phone className="w-5 h-5 text-primary" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">
                            Head Teacher
                          </p>
                          <p className="text-sm font-bold">
                            {schoolData.headTeacher}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">
                            Phone
                          </p>
                          <p className="text-sm font-bold">
                            {schoolData.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">
                            Email
                          </p>
                          <p className="text-sm font-bold">
                            {schoolData.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">
                            Established
                          </p>
                          <p className="text-sm font-bold">
                            {parseFloat(String(schoolData.establishedYear)) ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>

          {/* 3D View Modal - Ultra Rich Space Design */}
          {is3DViewOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            >
              {/* Ultra Rich Animated Space Background */}
              <div className="absolute inset-0 overflow-hidden">
                {/* Deep Space linear */}
                <div className="absolute inset-0 bg-[radial-linear(ellipse_at_center,var(--tw-linear-stops))] from-slate-950 via-blue-950/40 to-black"></div>

                {/* Nebula Effect 1 */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>

                {/* Nebula Effect 2 */}
                <div
                  className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-600/15 rounded-full blur-[80px] animate-pulse"
                  style={{ animationDelay: "1s" }}
                ></div>

                {/* Nebula Effect 3 */}
                <div
                  className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-[60px] animate-pulse"
                  style={{ animationDelay: "2s" }}
                ></div>

                {/* Stars - Layer 1 (Small) */}
                {[...Array(80)].map((_, i) => (
                  <div
                    key={`small-${i}`}
                    className="absolute bg-white rounded-full animate-pulse"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: `${Math.random() * 1.5 + 0.5}px`,
                      height: `${Math.random() * 1.5 + 0.5}px`,
                      animationDelay: `${Math.random() * 4}s`,
                      animationDuration: `${Math.random() * 2 + 2}s`,
                      opacity: Math.random() * 0.7 + 0.3,
                    }}
                  />
                ))}

                {/* Stars - Layer 2 (Medium with glow) */}
                {[...Array(30)].map((_, i) => (
                  <div
                    key={`medium-${i}`}
                    className="absolute rounded-full animate-pulse"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: `${Math.random() * 2 + 2}px`,
                      height: `${Math.random() * 2 + 2}px`,
                      animationDelay: `${Math.random() * 3}s`,
                      animationDuration: `${Math.random() * 3 + 2}s`,
                      boxShadow: `0 0 ${Math.random() * 4 + 2}px ${Math.random() * 2 + 1}px rgba(255,255,255,0.8)`,
                      background:
                        "radial-linear(circle, white 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                    }}
                  />
                ))}

                {/* Shooting Stars */}
                {[...Array(5)].map((_, i) => (
                  <div
                    key={`shooting-${i}`}
                    className="absolute w-1 h-1 bg-white rounded-full animate-ping"
                    style={{
                      left: `${10 + i * 20}%`,
                      top: `${5 + i * 15}%`,
                      animationDelay: `${i * 2}s`,
                      animationDuration: "3s",
                      boxShadow: "0 0 6px 2px rgba(255,255,255,0.8)",
                    }}
                  />
                ))}

                {/* Floating Particles */}
                {[...Array(15)].map((_, i) => (
                  <div
                    key={`particle-${i}`}
                    className="absolute w-0.5 h-0.5 bg-blue-400 rounded-full animate-bounce"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 5}s`,
                      animationDuration: `${Math.random() * 4 + 4}s`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative w-full max-w-6xl h-[85vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-linear-to-br from-slate-900/80 to-blue-950/30 backdrop-blur-sm"
              >
                {/* Animated Border Glow */}
                <div className="absolute inset-0 rounded-2xl border-2 border-white/10 animate-pulse"></div>
                <div
                  className="absolute inset-0 rounded-2xl border border-blue-500/20"
                  style={{
                    boxShadow:
                      "0 0 30px rgba(139, 92, 246, 0.3), inset 0 0 30px rgba(139, 92, 246, 0.1)",
                  }}
                ></div>
                {/* Main Content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {id && (
                    <img
                      src={`/public/uploads/schools/${id}/kmz_content/b0.png`}
                      alt="School Structure"
                      className="max-w-full max-h-full object-contain p-8 drop-shadow-2xl"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = `/public/uploads/schools/${id}/kmz_content/a.png`;
                      }}
                    />
                  )}
                </div>

                {/* Floating 3D View Button */}
                <div className="absolute bottom-8 right-8 z-20">
                  <Button
                    size="lg"
                    className="rounded-full px-10 py-7 bg-linear-to-r from-blue-600 via-blue-600 to-blue-600 hover:from-blue-700 hover:via-blue-700 hover:to-blue-700 text-white font-bold text-lg shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-all duration-300 transform hover:scale-110"
                    onClick={() => navigate(`/schools/${id}/3dview`)}
                  >
                    <Box className="w-6 h-6 mr-3" />
                    Open School Map
                  </Button>
                </div>

                {/* School Info Badge */}
                <div className="absolute top-6 left-6 z-20">
                  <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-6 py-3 border border-white/20 shadow-lg">
                    <p className="text-white font-bold text-lg">
                      {schoolData.name}
                    </p>
                    <p className="text-blue-300 text-sm font-medium">
                      {schoolData.code}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setIs3DViewOpen(false)}
                  className="absolute top-6 right-6 z-30 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full p-3 transition-all duration-300 hover:rotate-90"
                >
                  <XCircle className="w-8 h-8 text-white" />
                </button>

                {/* Bottom Stats */}
                <div className="absolute bottom-6 left-6 z-20 flex gap-4">
                  <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                    <p className="text-white/60 text-xs">Students</p>
                    <p className="text-white font-bold">
                      {formatNumber(totalStudents)}
                    </p>
                  </div>
                  <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                    <p className="text-white/60 text-xs">Teachers</p>
                    <p className="text-white font-bold">
                      {formatNumber(totalStaff)}
                    </p>
                  </div>
                  <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                    <p className="text-white/60 text-xs">Buildings</p>
                    <p className="text-white font-bold">{buildings.length}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* EDIT SCHOOL MODAL */}
          <SchoolForm
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              // Refetch school data after edit
              if (id) {
                api.get(`/schools/${id}`).then((res) => setSchool(res.data));
              }
            }}
            mode="edit"
            schoolId={id}
            initialData={schoolData}
          />
        </div>
      )}
      {/* FACILITY SURVEY MODAL */}
      {isSurveyModalOpen && (
        <FacilitySurveyForm
          schoolId={id!}
          schoolName={school?.name || ""}
          isOpen={isSurveyModalOpen}
          onClose={() => setIsSurveyModalOpen(false)}
        />
      )}
      {/* FACILITY DETAIL MODAL */}
      <Modal
        isOpen={isFacilityModalOpen}
        onClose={() => setIsFacilityModalOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">
                {selectedFacilityGroup?.facility} Details
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Detailed item-by-item compliance report
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/5">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                Total Items
              </p>
              <p className="text-2xl font-black">
                {selectedFacilityGroup?.total || 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/5">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                Compliance Rate
              </p>
              <p
                className={cn(
                  "text-2xl font-black",
                  (selectedFacilityGroup?.rate || 0) >= 70
                    ? "text-emerald-500"
                    : (selectedFacilityGroup?.rate || 0) >= 40
                      ? "text-amber-500"
                      : "text-red-500",
                )}
              >
                {selectedFacilityGroup?.rate || 0}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
              Itemized Status
            </p>
            <div className="border border-border/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/10">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Item Name
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {selectedFacilityGroup?.items?.map(
                    (item: any, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-bold">
                          {item.name || item.itemName || `Item ${idx + 1}`}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-black uppercase",
                              item.compliance === "compliant"
                                ? "bg-emerald-500/20 text-emerald-600"
                                : item.compliance === "partial"
                                  ? "bg-amber-500/20 text-amber-600"
                                  : "bg-red-500/20 text-red-600",
                            )}
                          >
                            {item.compliance}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                  {(!selectedFacilityGroup?.items ||
                    selectedFacilityGroup.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-8 text-center text-sm text-muted-foreground font-medium"
                      >
                        No detailed items available for this facility.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
      {/* BUILDING DETAIL MODAL */}
      <Modal
        isOpen={isBuildingModalOpen}
        onClose={() => setIsBuildingModalOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">
                {selectedBuilding?.name} Details
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Building assessment and infrastructure report
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        {selectedBuilding && (
          <div className="space-y-6 py-2">
            {/* Hero Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Condition",
                  value: selectedBuilding.condition,
                  detail: "Structural state",
                  color: getConditionBg(selectedBuilding.condition),
                },
                {
                  label: "Score",
                  value: `${selectedBuilding.structuralScore}%`,
                  detail: "Overall Health",
                  color: getConditionBg(selectedBuilding.condition),
                },
                {
                  label: "Year Built",
                  value: selectedBuilding.yearBuilt || "N/A",
                  detail: `Built ${calculateAge(selectedBuilding.yearBuilt)}y ago`,
                  color: "bg-blue-500/10 text-blue-600",
                },
                {
                  label: "Function",
                  value: selectedBuilding.function || "Educational",
                  detail: "Usage Type",
                  color: "bg-slate-500/10 text-slate-600",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-muted/30 border border-border/5"
                >
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1 leading-none">
                    {stat.label}
                  </p>
                  <p className="text-sm font-black truncate mb-0.5">
                    {stat.value}
                  </p>
                  <p className="text-[8px] font-bold text-muted-foreground/60 leading-none">
                    {stat.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Main Visualizations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-muted/20 border border-border/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4">
                    Structural Integrity Score
                  </h4>
                  <div className="relative w-32 h-32 mx-auto">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted/20"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(selectedBuilding.structuralScore / 100) * 352} 352`}
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "0 352" }}
                        animate={{
                          strokeDasharray: `${(selectedBuilding.structuralScore / 100) * 352} 352`,
                        }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn(
                          "transition-all",
                          getConditionColor(selectedBuilding.condition),
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black">
                        {selectedBuilding.structuralScore}%
                      </span>
                      <span className="text-[9px] font-black uppercase opacity-50">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-muted/20 border border-border/5 h-full">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4">
                    Space & Capacity
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">
                          Floors
                        </span>
                      </div>
                      <span className="text-sm font-black">
                        {selectedBuilding.floors} Levels
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                          <Maximize className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">
                          Footprint Area
                        </span>
                      </div>
                      <span className="text-sm font-black">
                        {formatNumber(selectedBuilding.areaSquareMeters)} m²
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">
                          Structure Age
                        </span>
                      </div>
                      <span className="text-sm font-black">
                        {calculateAge(selectedBuilding.yearBuilt)} Years
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Assessment List (Placeholders for real metrics if they exist in schema) */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
                Building Parameters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Occupancy Type",
                    value: selectedBuilding.occupancyType || "Standard",
                  },
                  {
                    label: "Material",
                    value: selectedBuilding.primaryMaterial || "Concrete/Steel",
                  },
                  {
                    label: "Priority Level",
                    value:
                      selectedBuilding.structuralScore < 50
                        ? "High"
                        : "Routine",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 rounded-2xl border border-border/10 bg-muted/10"
                  >
                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 leading-none mb-1">
                      {item.label}
                    </p>
                    <p className="text-xs font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
