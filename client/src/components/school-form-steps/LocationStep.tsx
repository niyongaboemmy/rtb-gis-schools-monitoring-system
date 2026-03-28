import { LocationPicker } from "../LocationPicker";

interface LocationStepProps {
  latitude: string;
  longitude: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  address: string;
  elevation: string;
  onLocationChange: (lat: string, lng: string) => void;
  onAdministrativeChange: (field: string, value: string) => void;
  onAddressChange: (value: string) => void;
  onElevationChange: (value: string) => void;
  kmz2dFilePath: string;
  tifFilePath: string;
  onGisChange: (field: string, value: string) => void;
}

export function LocationStep({
  latitude,
  longitude,
  province,
  district,
  sector,
  cell,
  village,
  address,
  elevation,
  onLocationChange,
  onAdministrativeChange,
  onAddressChange,
  onElevationChange,
  kmz2dFilePath,
  tifFilePath,
  onGisChange,
}: LocationStepProps) {
  return (
    <LocationPicker
      latitude={latitude}
      longitude={longitude}
      province={province}
      district={district}
      sector={sector}
      cell={cell}
      village={village}
      address={address}
      elevation={elevation}
      onLocationChange={onLocationChange}
      onAdministrativeChange={onAdministrativeChange}
      onAddressChange={onAddressChange}
      onElevationChange={onElevationChange}
      kmz2dFilePath={kmz2dFilePath}
      tifFilePath={tifFilePath}
      onGisChange={onGisChange}
    />
  );
}
