import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-display font-bold">Appearance</h2>
        <p className="text-muted-foreground">Customize how Cronkite looks on your device</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>
              Select your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              defaultValue={theme}
              onValueChange={(value) => setTheme(value)}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem value="light" id="light" className="peer sr-only" />
                <Label
                  htmlFor="light"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="mb-3 rounded-md border bg-[#FAFAF9] p-2 h-24 w-full flex items-center justify-center shadow-sm">
                    <div className="space-y-2 w-3/4">
                       <div className="h-2 w-3/4 bg-[#E4E4E7] rounded-full" />
                       <div className="h-2 w-1/2 bg-[#E4E4E7] rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <span className="font-medium">Light</span>
                  </div>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                <Label
                  htmlFor="dark"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="mb-3 rounded-md border bg-[#09090B] p-2 h-24 w-full flex items-center justify-center shadow-sm">
                    <div className="space-y-2 w-3/4">
                       <div className="h-2 w-3/4 bg-[#27272A] rounded-full" />
                       <div className="h-2 w-1/2 bg-[#27272A] rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    <span className="font-medium">Dark</span>
                  </div>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="system" id="system" className="peer sr-only" />
                <Label
                  htmlFor="system"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="mb-3 rounded-md border bg-gradient-to-r from-[#FAFAF9] to-[#09090B] p-2 h-24 w-full flex items-center justify-center shadow-sm opacity-80">
                    <div className="space-y-2 w-3/4 mix-blend-difference">
                       <div className="h-2 w-3/4 bg-gray-400 rounded-full" />
                       <div className="h-2 w-1/2 bg-gray-400 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">System</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
