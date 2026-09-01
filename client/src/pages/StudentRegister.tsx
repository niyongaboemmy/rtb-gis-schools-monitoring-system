import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Check, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { PasswordInput } from "../components/ui/password-input";
import { Button } from "../components/ui/button";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";

export default function StudentRegister() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const [step, setStep] = useState<"form" | "verification">("form");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First and last names are required");
      return false;
    }
    if (!formData.email.includes("@")) {
      setError("Valid email is required");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (!/(?=.*[a-z])/.test(formData.password)) {
      setError("Password must contain lowercase letter");
      return false;
    }
    if (!/(?=.*[A-Z])/.test(formData.password)) {
      setError("Password must contain uppercase letter");
      return false;
    }
    if (!/(?=.*\d)/.test(formData.password)) {
      setError("Password must contain number");
      return false;
    }
    if (!/(?=.*[@$!%*?&])/.test(formData.password)) {
      setError("Password must contain special character (@$!%*?&)");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (!formData.termsAccepted) {
      setError("You must accept the terms and conditions");
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await api.post("/auth/register", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        termsAccepted: formData.termsAccepted,
        accountType: "student",
      });

      setVerificationEmail(formData.email);
      setStep("verification");
    } catch (err: any) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (token: string) => {
    setIsLoading(true);
    try {
      await api.post("/auth/verify-email", { token });
      // Redirect to login after verification
      navigate("/login", {
        state: { message: "Email verified! You can now login." },
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden font-sans">
      <ImigongoPattern
        className="pointer-events-none fixed inset-0 text-primary mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]"
        opacity={0.04}
      />

      <div className="w-full flex items-center justify-center p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Student Registration
            </motion.div>
            <h2 className="text-4xl font-black tracking-tight text-foreground leading-[1.1]">
              Join Our Platform
            </h2>
            <p className="text-muted-foreground font-medium text-lg">
              Create your account to report facility issues and contribute to school improvement
            </p>
          </div>

          {step === "form" ? (
            <form onSubmit={handleRegister} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 flex items-start gap-3"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-foreground/80 ml-1">
                      First Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="John"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-foreground/80 ml-1">
                      Last Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-foreground/80 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-foreground/80 ml-1">
                    Password
                  </label>
                  <PasswordInput
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2 ml-1">
                    • At least 8 characters
                    <br />• Mix of uppercase and lowercase letters
                    <br />• At least one number
                    <br />• At least one special character (@$!%*?&)
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-foreground/80 ml-1">
                    Confirm Password
                  </label>
                  <PasswordInput
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    required
                  />
                  <label className="text-xs text-muted-foreground">
                    I agree to the{" "}
                    <a href="#" className="text-primary hover:underline font-semibold">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-primary hover:underline font-semibold">
                      Privacy Policy
                    </a>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95 transition-transform"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a
                    href="/login"
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </a>
                </p>
              </div>
            </form>
          ) : (
            <EmailVerificationStep
              email={verificationEmail}
              onVerify={handleVerification}
              isLoading={isLoading}
              error={error}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmailVerificationStep({
  email,
  onVerify,
  isLoading,
  error,
}: {
  email: string;
  onVerify: (token: string) => Promise<void>;
  isLoading: boolean;
  error: string;
}) {
  const [verificationCode, setVerificationCode] = useState("");

  const handleVerify = async () => {
    if (verificationCode.trim()) {
      await onVerify(verificationCode);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-2xl font-bold">Verify Your Email</h3>
        <p className="text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-semibold text-foreground">{email}</span>
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-center font-mono text-lg tracking-widest"
          placeholder="Paste verification code here"
          disabled={isLoading}
        />

        <Button
          onClick={handleVerify}
          disabled={!verificationCode.trim() || isLoading}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Verify Email
            </>
          )}
        </Button>
      </div>

      <div className="text-center space-y-2 pt-4 border-t border-border/20">
        <p className="text-xs text-muted-foreground">Didn't receive the email?</p>
        <Button
          variant="outline"
          className="w-full text-xs font-semibold"
          disabled={isLoading}
        >
          Resend Verification Code
        </Button>
      </div>
    </motion.div>
  );
}
