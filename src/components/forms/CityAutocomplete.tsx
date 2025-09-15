import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useItalianCities } from "@/hooks/useItalianCities"

interface CityAutocompleteProps {
  province: string
  city: string
  postalCode: string
  onProvinceChange: (province: string) => void
  onCityChange: (city: string) => void
  onPostalCodeChange: (postalCode: string) => void
}

export function CityAutocomplete({
  province,
  city,
  postalCode,
  onProvinceChange,
  onCityChange,
  onPostalCodeChange
}: CityAutocompleteProps) {
  const { provinces, cities, postalCodes, loading, getCitiesByProvince, searchCities, getPostalCodesByCity } = useItalianCities()
  const [cityOpen, setCityOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState("")

  // Aggiorna la ricerca città quando cambia la query o la provincia
  useEffect(() => {
    if (cityQuery.length >= 2) {
      searchCities(cityQuery, province || undefined)
    }
  }, [cityQuery, province])

  // Quando cambia la provincia, carica le città e reset
  useEffect(() => {
    if (province) {
      getCitiesByProvince(province)
      onCityChange("")
      onPostalCodeChange("")
    }
  }, [province])

  // Quando cambia la città, aggiorna i CAP disponibili
  useEffect(() => {
    if (city && province) {
      getPostalCodesByCity(city, province).then(codes => {
        if (codes.length === 1) {
          onPostalCodeChange(codes[0])
        } else if (codes.length === 0) {
          onPostalCodeChange("")
        }
      })
    }
  }, [city, province])

  const handleCitySelect = (selectedCity: string) => {
    onCityChange(selectedCity)
    setCityOpen(false)
    setCityQuery("")
  }

  const uniqueCities = cities.reduce((acc: string[], cityItem) => {
    if (!acc.includes(cityItem.city_name)) {
      acc.push(cityItem.city_name)
    }
    return acc
  }, [])

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label htmlFor="province">Provincia</Label>
        <Select value={province} onValueChange={onProvinceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona provincia" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((prov) => (
              <SelectItem key={prov.code} value={prov.code}>
                {prov.name} ({prov.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">Città</Label>
        <Popover open={cityOpen} onOpenChange={setCityOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={cityOpen}
              className="w-full justify-between"
              disabled={!province}
            >
              {city || "Seleziona città..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput 
                placeholder="Cerca città..." 
                value={cityQuery}
                onValueChange={setCityQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {loading ? "Caricamento..." : "Nessuna città trovata."}
                </CommandEmpty>
                <CommandGroup>
                  {uniqueCities.map((cityName) => (
                    <CommandItem
                      key={cityName}
                      value={cityName}
                      onSelect={() => handleCitySelect(cityName)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          city === cityName ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {cityName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="postal_code">CAP</Label>
        {postalCodes.length <= 1 ? (
          <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
            {postalCode || "---"}
          </div>
        ) : (
          <Select value={postalCode} onValueChange={onPostalCodeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona CAP" />
            </SelectTrigger>
            <SelectContent>
              {postalCodes.map((cap) => (
                <SelectItem key={cap} value={cap}>
                  {cap}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Paese</Label>
        <Select value="IT" disabled>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IT">Italia</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}