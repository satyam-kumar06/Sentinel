import {useQuery} from "@tanstack/react-query"
import axios from "axios"

export function useWeather(){
return useQuery({
queryKey:["weather"],
queryFn:async()=>{
const r=await axios.get("/weather")
return r.data
}
})
}
