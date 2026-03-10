import {useQuery} from "@tanstack/react-query"
import axios from "axios"

export function useHistory(){
return useQuery({
queryKey:["history"],
queryFn:async()=>{
const r=await axios.get("/history")
return r.data
}
})
}
