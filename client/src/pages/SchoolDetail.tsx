import { useParams, Navigate } from "react-router-dom";

export default function SchoolDetail() {
  const { id } = useParams<{ id: string }>();

  // Redirect to decision dashboard
  return <Navigate to={`/schools/${id}/decision`} replace />;
}
