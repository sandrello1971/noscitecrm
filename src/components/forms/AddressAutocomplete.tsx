import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddressAutocomplete, AddressResult } from '@/hooks/useAddressAutocomplete'
import { MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddressAutocompleteProps {
  address: string
  city: string
  province: string
  postalCode: string
  onAddressChange: (address: string) => void
  onCityChange: (city: string) => void
  onProvinceChange: (province: string) => void
  onPostalCodeChange: (postalCode: string) => void
  onAddressSelect?: (result: AddressResult) => void
}

export function AddressAutocomplete({
  address,
  city,
  province,
  postalCode,
  onAddressChange,
  onCityChange,
  onProvinceChange,
  onPostalCodeChange,
  onAddressSelect
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { query, setQuery, results, isLoading, error } = useAddressAutocomplete(300)

  // Sincronizza query con address quando cambia dall'esterno
  useEffect(() => {
    if (address !== query) {
      setQuery(address)
    }
  }, [address])

  // Gestisci click fuori dal componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gestione input
  const handleInputChange = (value: string) => {
    setQuery(value)
    onAddressChange(value)
    setIsOpen(true)
    setSelectedIndex(-1)
  }

  // Selezione indirizzo
  const handleSelectAddress = (result: AddressResult) => {
    onAddressChange(result.address || result.displayName.split(',')[0])
    onCityChange(result.city)
    onProvinceChange(result.province)
    onPostalCodeChange(result.postalCode)
    onAddressSelect?.(result)
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  // Gestione tastiera
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectAddress(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Campo Indirizzo con Autocompletamento */}
      <div className="space-y-2" ref={containerRef}>
        <Label htmlFor="address">Indirizzo</Label>
        <div className="relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="address"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Inizia a digitare l'indirizzo..."
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {/* Dropdown risultati */}
          {isOpen && (results.length > 0 || error) && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
              {error ? (
                <div className="p-3 text-sm text-destructive">{error}</div>
              ) : (
                <ul className="max-h-60 overflow-auto py-1">
                  {results.map((result, index) => (
                    <li
                      key={`${result.lat}-${result.lon}`}
                      className={cn(
                        "cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                        selectedIndex === index && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSelectAddress(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {result.address || result.displayName.split(',')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {result.postalCode && `${result.postalCode} - `}
                            {result.city}
                            {result.province && ` (${result.province})`}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {query.length > 0 && query.length < 3 && (
          <p className="text-xs text-muted-foreground">
            Digita almeno 3 caratteri per cercare
          </p>
        )}
      </div>

      {/* Campi compilati automaticamente */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">Città</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Milano"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Provincia</Label>
          <Input
            id="province"
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            placeholder="MI"
            maxLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postal_code">CAP</Label>
          <Input
            id="postal_code"
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            placeholder="20100"
            maxLength={5}
          />
        </div>
      </div>
    </div>
  )
}
