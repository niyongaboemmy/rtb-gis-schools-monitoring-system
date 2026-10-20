import { describe, expect, it } from "vitest";
import { actionLabel, fieldLabel, outcomeLabel, targetTypeLabel } from "./auditLabels";

describe("auditLabels", () => {
  it("maps known action codes to plain English", () => {
    expect(actionLabel("school.update")).toBe("Updated school");
    expect(actionLabel("auth.login_failed")).toBe("Failed sign-in");
    expect(actionLabel("role.update")).toBe("Updated role");
    expect(actionLabel("audit.export")).toBe("Exported audit trail");
  });

  it("humanises unknown dotted codes", () => {
    expect(actionLabel("widget.bulk_archive")).toBe("Bulk archive (widget)");
  });

  it("humanises fallback METHOD /route codes", () => {
    expect(actionLabel("PATCH /schools/:id/widgets")).toBe("Updated schools widgets");
    expect(actionLabel("DELETE /things/:id")).toBe("Deleted things");
  });

  it("handles empty input", () => {
    expect(actionLabel(undefined)).toBe("Unknown action");
    expect(targetTypeLabel(null)).toBe("—");
  });

  it("labels targets, outcomes and fields", () => {
    expect(targetTypeLabel("access_level")).toBe("Access level");
    expect(targetTypeLabel("new_thing")).toBe("New thing");
    expect(outcomeLabel("denied")).toBe("Denied");
    expect(outcomeLabel(undefined)).toBe("Success");
    expect(fieldLabel("passwordResetToken")).toBe("Password reset token");
    expect(fieldLabel("SchoolBuilding.floorCount#abc")).toBe("School building › Floor count");
  });
});
