import React from 'react';
import {
    BarChart3, Mail, Target, Search, Upload,
    Share2, Cookie, SearchCheck, DollarSign, ArrowRightLeft,
    ShoppingCart, ChevronRight, BookOpen, Shield, Globe,
    RefreshCw, Download, Package,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
    BarChart3, Mail, Target, Search, Upload,
    Share2, Cookie, SearchCheck, DollarSign, ArrowRightLeft,
    ShoppingCart, BookOpen, Shield, Globe, RefreshCw, Download,
};

interface PluginEntry {
    name: string;
    label: string;
    description: string;
    icon: string;
    color: string;
    bg: string;
    href: string;
}

interface Props {
    registry: PluginEntry[];
}

export default function PluginsHub({ registry }: Props) {
    if (registry.length === 0) {
        return (
            <div className="text-center py-16 bg-surface border border-dashed border-border rounded-lg">
                <Package className="w-10 h-10 text-ink-faint mx-auto mb-3" aria-hidden="true" />
                <h3 className="text-base font-semibold text-ink mb-1">Nenhum plugin disponível</h3>
                <p className="text-sm text-ink-muted max-w-xs mx-auto">
                    Os plugins aparecerão aqui quando forem configurados para este site.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registry.map(p => {
                const Icon = iconMap[p.icon] ?? Package;
                return (
                    <a
                        key={p.name}
                        href={p.href}
                        className="bg-surface p-6 rounded-lg border border-border hover:border-primary/40 hover:-translate-y-0.5 transition-all flex flex-col gap-4 group"
                        style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}
                    >
                        <div className="flex items-start justify-between">
                            <div className={`w-11 h-11 rounded-md ${p.bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`w-5 h-5 ${p.color}`} aria-hidden="true" />
                            </div>
                            <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" aria-hidden="true" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-ink mb-1 text-sm">{p.label}</h3>
                            <p className="text-xs text-ink-muted leading-relaxed">{p.description}</p>
                        </div>
                    </a>
                );
            })}
        </div>
    );
}
