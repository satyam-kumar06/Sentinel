export default function StatusDot({label,status}){
const color=status==="ok"?"bg-green":status==="degraded"?"bg-yellow":"bg-red"

return(
<div className="flex flex-col items-center text-[9px] font-mono">
<div className={`w-2 h-2 rounded-full ${color}`}/>
{label}
</div>
)
}
