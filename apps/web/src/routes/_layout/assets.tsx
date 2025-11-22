import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/assets')({
  component: AssetsPage,
})

function AssetsPage() {
  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] py-12">
      <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            Asset Explorer
          </h1>
          <p className="text-gray-400 text-lg">
            Coming soon: Browse and compare cross-chain assets
          </p>
        </div>
      </div>
    </div>
  )
}
