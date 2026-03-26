import { supabase } from "@/integrations/supabase/client";

export async function fetchMonthlyPayrollData(userId: string, year: number, month: number): Promise<{ 
  kpiScore: number, 
  workDays: number, 
  siteDays: number, 
  casualCount: number, 
  sickCount: number, 
  annualCount: number, 
  noShowCount: number,
  otDay: number,
  otNight: number,
  otSpecial: number
}> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const [callsRes, perfRes, shiftsRes] = await Promise.all([
    supabase
      .from('daily_survey_calls')
      .select('total_calls')
      .eq('user_id', userId)
      .gte('call_date', startDate)
      .lte('call_date', endDate),
    supabase
      .from('performance_data')
      .select('good, bad, genesys_good, genesys_bad')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('daily_shifts')
      .select('absence_type, is_off_day, is_site_day, shift_start, ot_hours_day, ot_hours_night, ot_hours_special')
      .eq('user_id', userId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
  ]);

  const validDays = (callsRes.data || []).filter(r => (r.total_calls || 0) > 0);
  const totalCalls = validDays.reduce((s, r) => s + (r.total_calls || 0), 0);
  const avg = validDays.length > 0 ? totalCalls / validDays.length : 0;
  const prodScore = avg >= 30 ? 100 : avg >= 28 ? 75 : avg >= 26 ? 50 : 0;

  const perfData = perfRes.data?.[0];
  let csatScore = 100;

  if (perfData) {
    const pData = perfData as any;
    const totalGood = (pData.good || 0) + (pData.genesys_good || 0);
    const totalBad = (pData.bad || 0) + (pData.genesys_bad || 0);
    const totalSamples = totalGood + totalBad;
    if (totalSamples > 0) {
      const csatPct = (totalGood / totalSamples) * 100;
      csatScore = csatPct >= 93 ? 100 : csatPct >= 90 ? 75 : csatPct >= 87 ? 50 : 0;
    }
  }

  const shiftsData = (shiftsRes.data as any) || [];
  
  let casualCount = 0;
  let sickCount = 0;
  let annualCount = 0;
  let noShowCount = 0;

  let workDays = 0;
  let siteDays = 0;
  let otDay = 0;
  let otNight = 0;
  let otSpecial = 0;

  for (const s of shiftsData) {
    if (s.absence_type === 'casual_leave') casualCount++;
    if (s.absence_type === 'sick_leave') sickCount++;
    if (s.absence_type === 'annual_leave') annualCount++;
    if (s.absence_type === 'no_show') noShowCount++;

    if (!s.is_off_day && s.shift_start) {
      workDays++;
      if (s.is_site_day) siteDays++;
    }

    otDay += Number(s.ot_hours_day || 0);
    otNight += Number(s.ot_hours_night || 0);
    otSpecial += Number(s.ot_hours_special || 0);
  }

  // ALL 4 of these absence types impact the KPI
  const totalAbsence = casualCount + sickCount + annualCount + noShowCount;
  const gate = totalAbsence <= 1 ? 100 : totalAbsence === 2 ? 75 : 0;

  const finalPercentage = ((prodScore * 0.5 + csatScore * 0.5) * gate) / 100;

  return { kpiScore: finalPercentage, workDays, siteDays, casualCount, sickCount, annualCount, noShowCount, otDay, otNight, otSpecial };
}
