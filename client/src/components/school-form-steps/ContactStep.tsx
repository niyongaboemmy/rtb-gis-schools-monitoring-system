import { Input } from "../ui/input";
import { Phone, Mail, User } from "lucide-react";

interface ContactStepProps {
  phone: string;
  email: string;
  headTeacher: string;
  onChange: (field: string, value: string) => void;
}

export function ContactStep({
  phone,
  email,
  headTeacher,
  onChange,
}: ContactStepProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
          <label className="text-base font-bold text-foreground">
            Contact Information
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone
            </label>
            <Input
              name="phone"
              type="tel"
              placeholder="+250 7xx xxx xxx"
              value={phone}
              onChange={(e) => onChange("phone", e.target.value)}
              icon={<Phone className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </label>
            <Input
              name="email"
              type="email"
              placeholder="school@example.com"
              value={email}
              onChange={(e) => onChange("email", e.target.value)}
              icon={<Mail className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Head Teacher / Director
            </label>
            <Input
              name="headTeacher"
              placeholder="Full name of head teacher"
              value={headTeacher}
              onChange={(e) => onChange("headTeacher", e.target.value)}
              icon={<User className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
