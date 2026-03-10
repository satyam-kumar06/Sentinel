import {useQuery} from "@tanstack/react-query"
import axios from "axios"

export function useStatus(){
return useQuery({
queryKey:["status"],
queryFn:async()=>{
const r=await axios.get("/status")
return r.data
}
})
}
