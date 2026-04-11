interface SectionHeaderProps {
	children: React.ReactNode;
}

export const SectionHeader = ({ children }: SectionHeaderProps) => {
	return <span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>{children}</span>;
};
