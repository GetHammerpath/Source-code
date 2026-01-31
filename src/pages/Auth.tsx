// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { supabase } from "@/integrations/supabase/client";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { useToast } from "@/hooks/use-toast";
// import { Video } from "lucide-react";

// const Auth = () => {
//   const [loading, setLoading] = useState(false);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [fullName, setFullName] = useState("");
//   const navigate = useNavigate();
//   const { toast } = useToast();

//   const handleSignIn = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     const { error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//       toast({
//         title: "Error",
//         description: error.message,
//         variant: "destructive",
//       });
//     } else {
//       toast({
//         title: "Success",
//         description: "Logged in successfully",
//       });
//       navigate("/");
//     }

//     setLoading(false);
//   };

//   const handleSignUp = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     const { error } = await supabase.auth.signUp({
//       email,
//       password,
//       options: {
//         data: {
//           full_name: fullName,
//         },
//         emailRedirectTo: `${window.location.origin}/`,
//       },
//     });

//     if (error) {
//       toast({
//         title: "Error",
//         description: error.message,
//         variant: "destructive",
//       });
//     } else {
//       toast({
//         title: "Success",
//         description: "Account created successfully! You can now log in.",
//       });
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-background p-4">
//       <Card className="w-full max-w-md shadow-elegant">
//         <CardHeader className="text-center">
//           <div className="flex justify-center mb-4">
//             <div className="p-3 bg-gradient-primary rounded-lg">
//               <Video className="h-8 w-8 text-primary-foreground" />
//             </div>
//           </div>
//           <CardTitle className="text-2xl font-bold">Video Portal</CardTitle>
//           <CardDescription>Access your video production workflow</CardDescription>
//         </CardHeader>
//         <CardContent>
//           <Tabs defaultValue="signin" className="w-full">
//             <TabsList className="grid w-full grid-cols-2">
//               <TabsTrigger value="signin">Sign In</TabsTrigger>
//               <TabsTrigger value="signup">Sign Up</TabsTrigger>
//             </TabsList>
//             <TabsContent value="signin">
//               <form onSubmit={handleSignIn} className="space-y-4">
//                 <div className="space-y-2">
//                   <Label htmlFor="email">Email</Label>
//                   <Input
//                     id="email"
//                     type="email"
//                     placeholder="your@email.com"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label htmlFor="password">Password</Label>
//                   <Input
//                     id="password"
//                     type="password"
//                     placeholder="••••••••"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     required
//                   />
//                 </div>
//                 <Button type="submit" className="w-full" disabled={loading}>
//                   {loading ? "Signing in..." : "Sign In"}
//                 </Button>
//               </form>
//             </TabsContent>
//             <TabsContent value="signup">
//               <form onSubmit={handleSignUp} className="space-y-4">
//                 <div className="space-y-2">
//                   <Label htmlFor="fullname">Full Name</Label>
//                   <Input
//                     id="fullname"
//                     type="text"
//                     placeholder="John Doe"
//                     value={fullName}
//                     onChange={(e) => setFullName(e.target.value)}
//                     required
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label htmlFor="signup-email">Email</Label>
//                   <Input
//                     id="signup-email"
//                     type="email"
//                     placeholder="your@email.com"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label htmlFor="signup-password">Password</Label>
//                   <Input
//                     id="signup-password"
//                     type="password"
//                     placeholder="••••••••"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     required
//                     minLength={6}
//                   />
//                 </div>
//                 <Button type="submit" className="w-full" disabled={loading}>
//                   {loading ? "Creating account..." : "Sign Up"}
//                 </Button>
//               </form>
//             </TabsContent>
//           </Tabs>
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default Auth;
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const PENDING_AVATAR_KEY = "hp:pending_avatar";

  const defaultTab = useMemo<"signin" | "signup">(() => {
    if (location.pathname === "/signup") return "signup";
    const qs = new URLSearchParams(location.search);
    const hasBridgeParams = !!(qs.get("selected_image_url") || qs.get("avatar_name"));
    return hasBridgeParams ? "signup" : "signin";
  }, [location.pathname, location.search]);

  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);

  // Capture reverse-onboarding state from URL params (or keep existing localStorage draft).
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const selectedImageUrl = (qs.get("selected_image_url") || "").trim();
    const avatarName = (qs.get("avatar_name") || "").trim();

    if (selectedImageUrl || avatarName) {
      const raw = localStorage.getItem(PENDING_AVATAR_KEY);
      let existing: { selected_image_url?: string; avatar_name?: string } = {};
      try {
        existing = raw ? (JSON.parse(raw) as typeof existing) : {};
      } catch {
        existing = {};
      }
      localStorage.setItem(
        PENDING_AVATAR_KEY,
        JSON.stringify({
          selected_image_url: selectedImageUrl || existing.selected_image_url,
          avatar_name: avatarName || existing.avatar_name,
        })
      );
      setTab("signup");
    }
  }, [location.search, location.pathname]);

  const maybeCreateAvatarFromPending = async () => {
    const raw = localStorage.getItem(PENDING_AVATAR_KEY);
    if (!raw) return;

    let draft: { selected_image_url?: string; avatar_name?: string } | null = null;
    try {
      draft = JSON.parse(raw) as typeof draft;
    } catch {
      localStorage.removeItem(PENDING_AVATAR_KEY);
      return;
    }

    const selectedImageUrl = (draft?.selected_image_url || "").trim();
    const avatarName = (draft?.avatar_name || "").trim();
    if (!selectedImageUrl || !avatarName) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Best-effort idempotency: if we already created this exact avatar, don't create again.
    const { data: existing, error: existingError } = await (supabase as any)
      .from("avatars")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", avatarName)
      .eq("seed_image_url", selectedImageUrl)
      .limit(1);

    if (!existingError && Array.isArray(existing) && existing.length > 0) {
      localStorage.removeItem(PENDING_AVATAR_KEY);
      return;
    }

    const { error: insertError } = await (supabase as any)
      .from("avatars")
      .insert({
        user_id: user.id,
        name: avatarName,
        seed_image_url: selectedImageUrl,
        voice_id: null,
      });

    if (insertError) {
      console.warn("Failed to create avatar from pending draft:", insertError);
      return;
    }

    localStorage.removeItem(PENDING_AVATAR_KEY);
    toast({
      title: "Avatar created",
      description: `Created "${avatarName}" for your account.`,
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      await maybeCreateAvatarFromPending();
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // If a session was created immediately, we can create the avatar right now.
      // If email confirmation is required and no session exists, we'll create it after sign-in.
      if (data?.session) {
        await maybeCreateAvatarFromPending();
        toast({
          title: "Success",
          description: "Account created successfully!",
        });
        navigate("/dashboard");
      } else {
      toast({
        title: "Success",
        description: "Account created successfully! Please check your email to confirm, then log in.",
      });
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/images/suosuo_logo.png" alt="Suosuo" className="h-12 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Suosuo</CardTitle>
          <CardDescription>Access your video production workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
