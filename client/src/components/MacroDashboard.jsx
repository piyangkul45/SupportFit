import { useTranslation } from 'react-i18next'
import MacroProgressBar from './MacroProgressBar'

export default function MacroDashboard({
  totalCalories,
  totalProtein,
  targetCalories,
  targetProtein,
}) {
  const { t } = useTranslation()

  return (
    <div className="glass-card mx-auto mt-6 w-full max-w-md space-y-4 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-400/10 text-base">
          🎯
        </span>
        {t('dashboard.targets.title')}
      </h3>
      <MacroProgressBar
        label={t('dashboard.targets.calories')}
        current={totalCalories}
        target={targetCalories}
        unit={t('common.units.kcal')}
      />
      <MacroProgressBar
        label={t('dashboard.targets.protein')}
        current={totalProtein}
        target={targetProtein}
        unit={t('common.units.g')}
      />
    </div>
  )
}
