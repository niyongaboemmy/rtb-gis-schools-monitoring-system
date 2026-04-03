import React, { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  Phone,
  Check,
  ChevronRight,
  ChevronLeft,
  Home,
  BookOpen,
  Users,
} from "lucide-react";
import {
  BasicInfoStep,
  LocationStep,
  ContactStep,
  ProgramsStep,
  StaffStep,
  BuildingsStep,
  LandStep,
  type BuildingData,
  type EducationProgram,
} from "./school-form-steps";
import { useAuthorization } from "../hooks/useAuthorization";
import { Permission, type PermissionType } from "../lib/permissions";

export interface SchoolFormData {
  code: string;
  name: string;
  type: string;
  status: string;
  description: string;
  establishedYear: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  latitude: string;
  longitude: string;
  elevation: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  headTeacher: string;
  buildingName: string;
  buildingCode: string;
  buildingFunction: string;
  buildingFloors: string;
  buildingArea: string;
  buildingYearBuilt: string;
  buildingCondition: string;
  buildingRoofCondition: string;
  buildingStructuralScore: string;
  buildingNotes: string;
  buildings: BuildingData[];
  educationPrograms: EducationProgram[];
  maleTeachers: string;
  femaleTeachers: string;
  maleStudents: string;
  femaleStudents: string;
  adminStaff: string;
  maleAdminStaff: string;
  femaleAdminStaff: string;
  supportStaff: string;
  maleSupportStaff: string;
  femaleSupportStaff: string;
  totalTeachers: string;
  totalStudents: string;
  numberOfAccessRoads: string;
  roadState: string;
  roadStatusPercentage: string;
  usedLandArea: string;
  unusedLandArea: string;
  kmz2dFilePath: string;
  tifFilePath: string;
}

interface SchoolFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<SchoolFormData>;
  mode?: "create" | "edit";
  schoolId?: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  permission?: PermissionType;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Basic Info",
    description: "Institution details",
    icon: <Building2 className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_BASIC,
  },
  {
    id: 2,
    title: "Location",
    description: "Geographic data",
    icon: <MapPin className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_LOCATION,
  },
  {
    id: 3,
    title: "Contact",
    description: "Contact information",
    icon: <Phone className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_CONTACT,
  },
  {
    id: 4,
    title: "Trades",
    description: "TVET Trades",
    icon: <BookOpen className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_PROGRAMS,
  },
  {
    id: 5,
    title: "Staff",
    description: "Staff details",
    icon: <Users className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_STAFF,
  },
  {
    id: 6,
    title: "Land",
    description: "Land area & Access",
    icon: <Home className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_LAND,
  },
  {
    id: 7,
    title: "Buildings",
    description: "Building details",
    icon: <Home className="w-5 h-5" />,
    permission: Permission.EDIT_SCHOOL_BUILDINGS,
  },
];

const defaultFormData: SchoolFormData = {
  code: "",
  name: "",
  type: "TSS",
  status: "active",
  description: "",
  establishedYear: "",
  province: "",
  district: "",
  sector: "",
  cell: "",
  village: "",
  latitude: "",
  longitude: "",
  elevation: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  headTeacher: "",
  buildingName: "",
  buildingCode: "",
  buildingFunction: "",
  buildingFloors: "",
  buildingArea: "",
  buildingYearBuilt: "",
  buildingCondition: "good",
  buildingRoofCondition: "good",
  buildingStructuralScore: "",
  buildingNotes: "",
  buildings: [],
  educationPrograms: [],
  maleTeachers: "",
  femaleTeachers: "",
  maleStudents: "",
  femaleStudents: "",
  adminStaff: "",
  maleAdminStaff: "",
  femaleAdminStaff: "",
  supportStaff: "",
  maleSupportStaff: "",
  femaleSupportStaff: "",
  totalTeachers: "",
  totalStudents: "",
  numberOfAccessRoads: "",
  roadState: "",
  roadStatusPercentage: "",
  usedLandArea: "",
  unusedLandArea: "",
  kmz2dFilePath: "",
  tifFilePath: "",
} as SchoolFormData;

export function SchoolForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  mode = "create",
  schoolId,
}: SchoolFormProps) {
  const { isAuthorized } = useAuthorization();
  const [currentStep, setCurrentStep] = useState(1);

  // Filter steps based on permissions
  const visibleSteps = steps.filter(
    (step) =>
      !step.permission ||
      isAuthorized(step.permission) ||
      isAuthorized(Permission.MANAGE_SCHOOLS),
  );

  const [formData, setFormData] = useState<SchoolFormData>(() => ({
    ...defaultFormData,
    ...(initialData as Partial<SchoolFormData>),
  }));

  // Transform API building response to frontend format
  const transformBuildingsFromApi = (buildings: any[]): BuildingData[] => {
    if (!buildings || !Array.isArray(buildings)) return [];
    return buildings.map((b) => ({
      id: b.id || "",
      buildingName: b.name || "",
      buildingCode: b.buildingCode || "",
      buildingFunction: b.function || "",
      buildingFloors: b.floors?.toString() || "",
      buildingArea: b.areaSquareMeters?.toString() || "",
      buildingYearBuilt: b.yearBuilt?.toString() || "",
      buildingCondition: b.condition || "good",
      buildingRoofCondition: b.roofCondition || "good",
      buildingStructuralScore: b.structuralScore?.toString() || "",
      buildingNotes: b.notes || "",
      facilities: Array.isArray(b.facilities) ? b.facilities : [],
      geolocation: {
        latitude: b.centroidLat ?? null,
        longitude: b.centroidLng ?? null,
      },
    }));
  };

  // Update form data when initialData changes (for edit mode)
  React.useEffect(() => {
    if (isOpen && initialData) {
      // Transform buildings from API format to frontend format
      const transformedBuildings = transformBuildingsFromApi(
        initialData?.buildings || [],
      );

      // Transform boolean facility fields to string format for the form
      const booleanFields = [
        "hasLibrary",
        "hasLaboratory",
        "hasComputerLab",
        "hasSportsField",
        "hasHostel",
        "hasCanteen",
        "hasElectricity",
        "hasWater",
        "hasInternet",
        "hasSolarPanel",
      ];

      const transformedBooleanFields: Partial<SchoolFormData> = {};
      booleanFields.forEach((field) => {
        if (initialData[field as keyof SchoolFormData] !== undefined) {
          (transformedBooleanFields as Record<string, string>)[field] =
            initialData[field as keyof SchoolFormData] ? "true" : "false";
        }
      });

      setFormData((prev) => ({
        ...prev,
        ...initialData,
        ...transformedBooleanFields,
        buildings: transformedBuildings,
      }));
    }
  }, [isOpen, initialData]);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: SchoolFormData) => ({
      ...prev,
      [field as keyof SchoolFormData]: value,
    }));
  };

  const nextStep = () => {
    const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex < visibleSteps.length - 1) {
      setCurrentStep(visibleSteps[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(visibleSteps[currentIndex - 1].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    // Validate required fields
    if (!formData.latitude || !formData.longitude) {
      alert("Please select a location on the map");
      setSubmitLoading(false);
      return;
    }

    try {
      // Send all fields that the server accepts
      const payload: Record<string, unknown> = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        status: formData.status,
        description: formData.description,
        establishedYear: formData.establishedYear
          ? parseInt(formData.establishedYear)
          : null,
        province: formData.province,
        district: formData.district,
        sector: formData.sector,
        cell: formData.cell,
        village: formData.village,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        elevation: formData.elevation ? parseFloat(formData.elevation) : null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        headTeacher: formData.headTeacher || null,
        // Staff
        maleTeachers: formData.maleTeachers
          ? parseInt(formData.maleTeachers)
          : null,
        femaleTeachers: formData.femaleTeachers
          ? parseInt(formData.femaleTeachers)
          : null,
        maleStudents: formData.maleStudents
          ? parseInt(formData.maleStudents)
          : null,
        femaleStudents: formData.femaleStudents
          ? parseInt(formData.femaleStudents)
          : null,
        totalStudents: formData.totalStudents
          ? parseInt(formData.totalStudents)
          : null,
        adminStaff: formData.adminStaff ? parseInt(formData.adminStaff) : null,
        maleAdminStaff: formData.maleAdminStaff
          ? parseInt(formData.maleAdminStaff)
          : null,
        femaleAdminStaff: formData.femaleAdminStaff
          ? parseInt(formData.femaleAdminStaff)
          : null,
        supportStaff: formData.supportStaff
          ? parseInt(formData.supportStaff)
          : null,
        maleSupportStaff: formData.maleSupportStaff
          ? parseInt(formData.maleSupportStaff)
          : null,
        femaleSupportStaff: formData.femaleSupportStaff
          ? parseInt(formData.femaleSupportStaff)
          : null,
        // Roads & Land
        numberOfAccessRoads: formData.numberOfAccessRoads
          ? parseInt(formData.numberOfAccessRoads)
          : null,
        roadState: formData.roadState || null,
        roadStatusPercentage: formData.roadStatusPercentage
          ? parseInt(formData.roadStatusPercentage)
          : null,
        // Land
        usedLandArea: formData.usedLandArea
          ? parseFloat(formData.usedLandArea)
          : null,
        unusedLandArea: formData.unusedLandArea
          ? parseFloat(formData.unusedLandArea)
          : null,
        // trades (TVET Trades)
        educationPrograms: formData.educationPrograms
          .filter((p) => p.name.trim() !== "")
          .map((p) => ({
            code: p.code || null,
            name: p.name,
            totalStudents: p.totalStudents ? parseInt(p.totalStudents) : null,
            capacity: p.capacity ? parseInt(p.capacity) : null,
          })),
        // Buildings
        buildings: formData.buildings
          .filter((b) => b.buildingName.trim() !== "")
          .map((b) => ({
            name: b.buildingName,
            code: b.buildingCode || null,
            function: b.buildingFunction || null,
            floors: b.buildingFloors ? parseInt(b.buildingFloors) : null,
            area: b.buildingArea ? parseFloat(b.buildingArea) : null,
            yearBuilt: b.buildingYearBuilt
              ? parseInt(b.buildingYearBuilt)
              : null,
            condition: b.buildingCondition || "good",
            roofCondition: b.buildingRoofCondition || "good",
            structuralScore: b.buildingStructuralScore
              ? parseFloat(b.buildingStructuralScore)
              : null,
            notes: b.buildingNotes || null,
            facilities: b.facilities.length > 0 ? b.facilities : null,
            latitude: b.geolocation.latitude ?? null,
            longitude: b.geolocation.longitude ?? null,
          })),
        kmz2dFilePath: formData.kmz2dFilePath || null,
        tifFilePath: formData.tifFilePath || null,
      };

      if (mode === "edit" && schoolId) {
        await api.patch(`/schools/${schoolId}`, payload);
      } else {
        await api.post("/schools", payload);
      }

      setFormData(defaultFormData);
      setCurrentStep(1);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to save school", err);
      alert("Failed to save school. Check console for details.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    if (initialData) {
      setFormData({ ...defaultFormData, ...initialData } as SchoolFormData);
    } else {
      setFormData(defaultFormData);
    }
    setCurrentStep(1);
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <BasicInfoStep
            code={formData.code}
            name={formData.name}
            type={formData.type}
            status={formData.status}
            description={formData.description}
            establishedYear={formData.establishedYear}
            website={formData.website}
            mode={mode}
            onChange={handleInputChange}
          />
        );
      case 2:
        return (
          <LocationStep
            latitude={formData.latitude}
            longitude={formData.longitude}
            province={formData.province}
            district={formData.district}
            sector={formData.sector}
            cell={formData.cell}
            village={formData.village}
            address={formData.address}
            elevation={formData.elevation}
            onLocationChange={(lat, lng) => {
              handleInputChange("latitude", lat);
              handleInputChange("longitude", lng);
            }}
            onAdministrativeChange={handleInputChange}
            onAddressChange={(value) => handleInputChange("address", value)}
            onElevationChange={(value) => handleInputChange("elevation", value)}
            kmz2dFilePath={formData.kmz2dFilePath}
            tifFilePath={formData.tifFilePath}
            onGisChange={handleInputChange}
          />
        );
      case 3:
        return (
          <ContactStep
            phone={formData.phone}
            email={formData.email}
            headTeacher={formData.headTeacher}
            onChange={handleInputChange}
          />
        );
      case 4:
        return (
          <ProgramsStep
            educationPrograms={formData.educationPrograms}
            onEducationProgramsChange={(programs) =>
              setFormData((prev) => ({ ...prev, educationPrograms: programs }))
            }
          />
        );
      case 5:
        return (
          <StaffStep
            maleTeachers={formData.maleTeachers}
            femaleTeachers={formData.femaleTeachers}
            maleStudents={formData.maleStudents}
            femaleStudents={formData.femaleStudents}
            maleAdminStaff={formData.maleAdminStaff}
            femaleAdminStaff={formData.femaleAdminStaff}
            maleSupportStaff={formData.maleSupportStaff}
            femaleSupportStaff={formData.femaleSupportStaff}
            totalStudents={formData.totalStudents}
            onChange={handleInputChange}
          />
        );
      case 6:
        return (
          <LandStep
            usedLandArea={formData.usedLandArea}
            unusedLandArea={formData.unusedLandArea}
            numberOfAccessRoads={formData.numberOfAccessRoads}
            roadState={formData.roadState}
            roadStatusPercentage={formData.roadStatusPercentage}
            onChange={handleInputChange}
          />
        );
      case 7:
        return (
          <BuildingsStep
            buildings={formData.buildings}
            onBuildingsChange={(buildings) =>
              setFormData((prev) => ({ ...prev, buildings }))
            }
            schoolLatitude={
              formData.latitude ? parseFloat(formData.latitude) : null
            }
            schoolLongitude={
              formData.longitude ? parseFloat(formData.longitude) : null
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title=""
      description=""
      maxWidth="max-w-[1400px]"
      className="h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-[calc(100vw-40px)] md:w-[calc(100vw-80px)] lg:w-[calc(100vw-120px)]"
    >
      <div className="flex flex-col md:flex-row h-full -m-6">
        {/* Mobile: Horizontal step bar */}
        <div className="md:hidden flex flex-col border-b border-border/50 bg-linear-to-b from-primary/10 via-primary/5 to-background shrink-0">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-lg font-bold text-foreground">
              {mode === "edit" ? "Edit Institution" : "Register School"}
            </h2>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 pb-3">
            {visibleSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 transition-all text-xs font-semibold ${currentStep === step.id ? "bg-primary text-white" : currentStep > step.id ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center ${currentStep === step.id ? "bg-white/20" : currentStep > step.id ? "bg-green-500" : "bg-background"}`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <span className="text-[10px]">{step.id}</span>
                  )}
                </div>
                {step.title}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Left Sidebar - Vertical Steps */}
        <div
          className="hidden md:flex w-72 min-w-[288px] bg-linear-to-b from-primary/10 via-primary/5 to-background border-r border-border/50 flex-col"
          style={{ height: "calc(100vh - 100px)" }}
        >
          <div className="p-6 pb-4">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "edit" ? "Edit Institution" : "Register School"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "edit"
                ? "Update institution information"
                : "Fill in the school details"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
            {visibleSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left ${currentStep === step.id ? "bg-primary text-white" : currentStep > step.id ? "bg-green-500/10 text-green-600" : "hover:bg-muted text-muted-foreground"}`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentStep === step.id ? "bg-white/20" : currentStep > step.id ? "bg-green-500" : "bg-muted"}`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm">{step.title}</div>
                  <div
                    className={`text-xs ${currentStep === step.id ? "text-white/70" : "text-muted-foreground"}`}
                  >
                    {step.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Step {visibleSteps.findIndex((s) => s.id === currentStep) + 1} of{" "}
              {visibleSteps.length}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                e.preventDefault();
              }
            }}
            className="flex-1 flex flex-col"
          >
            <div
              className="overflow-y-auto p-4 md:p-8"
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
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Fixed Bottom Navigation */}
            <div className="px-4 md:px-8 py-2 pb-0 -mb-2 bg-background border-t border-border/50 flex justify-between items-center shrink-0">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={currentStep === 1 ? handleCancel : prevStep}
                className="rounded-full font-semibold px-4 md:px-8 h-10 md:h-12 text-sm"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>

              {currentStep !== visibleSteps[visibleSteps.length - 1]?.id ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={nextStep}
                  className="rounded-full font-semibold px-5 md:px-10 h-10 md:h-12 text-sm bg-primary hover:bg-primary/90"
                >
                  Continue
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitLoading}
                  size="lg"
                  className="rounded-full font-semibold px-5 md:px-10 h-10 md:h-12 text-sm bg-primary hover:bg-primary/90"
                >
                  {submitLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5" />
                      {mode === "edit"
                        ? "Save Changes"
                        : "Register Institution"}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
