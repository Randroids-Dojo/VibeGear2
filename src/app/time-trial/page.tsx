import { redirect } from "next/navigation";

export default function TimeTrialPage(): never {
  redirect("/race?mode=timeTrial");
}
