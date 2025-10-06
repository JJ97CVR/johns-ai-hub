import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import lexLogo from '@/assets/lex-logo.png';
import carBackground from '@/assets/car-background.png';

const authSchema = z.object({
  email: z.string().email('Vänligen ange en giltig e-postadress').max(255),
  password: z.string().min(8, 'Lösenordet måste vara minst 8 tecken').max(100),
});

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: 'Valideringsfel',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Kontot finns redan',
              description: 'Denna e-post är redan registrerad. Logga in istället.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Fel',
              description: 'Kunde inte skapa konto. Försök igen.',
              variant: 'destructive',
            });
          }
          setLoading(false);
          return;
        }

        toast({
          title: 'Klart!',
          description: 'Konto skapat! Du kan nu logga in.',
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast({
            title: 'Inloggning misslyckades',
            description: 'Ogiltig e-post eller lösenord. Försök igen.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        navigate('/lexbot');
      }
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Ett oväntat fel inträffade. Försök igen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="mb-16">
            <img src={lexLogo} alt="LEX Automotive" className="h-[89px] w-[77px]" />
          </div>

          {/* Form */}
          <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-2">
              <h1 className="text-[32px] font-medium leading-[39px] text-[#000000]">
                {isSignUp ? 'Skapa konto' : 'Logga in'}
              </h1>
              <p className="text-base font-normal leading-[160%] text-[#666666]">
                Var vänlig att logga in för att komma in till LEX Automotive
              </p>
            </div>

            {/* Form fields */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label 
                  htmlFor="email" 
                  className="text-sm font-normal leading-[160%] tracking-[-0.02em] text-[#222222]"
                >
                  E-post
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Ange din e-post"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email"
                  className="h-[46px] px-[14px] py-[10px] bg-white border border-[#D1D5DB] rounded-[3px] text-base placeholder:text-[#A3A3A3]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label 
                  htmlFor="password"
                  className="text-sm font-normal leading-[160%] tracking-[-0.02em] text-[#222222]"
                >
                  Lösenord
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Lösenord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="password"
                  className="h-[46px] px-[14px] py-[10px] bg-white border border-[#D1D5DB] rounded-[3px] text-base placeholder:text-[#A3A3A3]"
                />
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  data-testid={isSignUp ? "signup" : "login"}
                  className="h-[46px] bg-[#2A5AA2] hover:bg-[#234a8a] text-white font-medium text-xs tracking-[-0.02em] uppercase rounded-[3px]"
                >
                  {loading ? (isSignUp ? 'Skapar konto...' : 'Loggar in...') : (isSignUp ? 'SKAPA KONTO' : 'LOGGA IN')}
                </Button>

                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-base font-normal leading-[160%] text-[#666666] hover:text-[#222222] transition-colors"
                >
                  {isSignUp ? 'Har du redan ett konto? Logga in' : 'Skapa konto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div 
        className="hidden lg:block lg:w-1/2 bg-cover bg-center"
        style={{ backgroundImage: `url(${carBackground})` }}
      />
    </div>
  );
};

export default Auth;
