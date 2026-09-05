export default function PrintButton({label='طباعة التقرير'}:{label?:string}){return <button className="btn secondary no-print" onClick={()=>window.print()}>🖨 {label}</button>}
