import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface ItalianCity {
  id: string
  province_code: string
  province_name: string
  city_name: string
  postal_code: string
  region: string
}

interface Province {
  code: string
  name: string
  region: string
}

export function useItalianCities() {
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<ItalianCity[]>([])
  const [postalCodes, setPostalCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Carica tutte le province all'avvio
  useEffect(() => {
    async function fetchProvinces() {
      const { data } = await supabase
        .from('italian_cities')
        .select('province_code, province_name, region')
        .order('province_name')

      if (data) {
        const uniqueProvinces = Array.from(
          new Map(data.map(item => [item.province_code, {
            code: item.province_code,
            name: item.province_name,
            region: item.region
          }])).values()
        )
        setProvinces(uniqueProvinces)
      }
    }
    
    fetchProvinces()
  }, [])

  // Carica le città per una provincia
  const getCitiesByProvince = async (provinceCode: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('italian_cities')
        .select('*')
        .eq('province_code', provinceCode)
        .order('city_name')

      if (data) {
        setCities(data)
      }
    } finally {
      setLoading(false)
    }
  }

  // Cerca città per nome (filtrato per provincia se specificata)
  const searchCities = async (searchTerm: string, provinceCode?: string) => {
    setLoading(true)
    try {
      let query = supabase
        .from('italian_cities')
        .select('*')
        .ilike('city_name', `%${searchTerm}%`)
        
      if (provinceCode) {
        query = query.eq('province_code', provinceCode)
      }
      
      const { data } = await query
        .order('city_name')
        .limit(10)

      if (data) {
        setCities(data)
      }
    } finally {
      setLoading(false)
    }
  }

  // Carica i CAP per una specifica città
  const getPostalCodesByCity = async (cityName: string, provinceCode?: string) => {
    try {
      let query = supabase
        .from('italian_cities')
        .select('postal_code')
        .eq('city_name', cityName)
        
      if (provinceCode) {
        query = query.eq('province_code', provinceCode)
      }
      
      const { data } = await query.order('postal_code')

      if (data) {
        const codes = data.map(item => item.postal_code)
        setPostalCodes([...new Set(codes)]) // Rimuovi duplicati
      }
    } catch (error) {
      console.error('Error fetching postal codes:', error)
    }
  }

  return {
    provinces,
    cities,
    postalCodes,
    loading,
    getCitiesByProvince,
    searchCities,
    getPostalCodesByCity
  }
}