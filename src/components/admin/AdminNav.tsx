import React from 'react';
import {
    FileText, Tag, Users, Info, Phone,
    Shield, Settings, LogOut, ExternalLink, Navigation,
    Package, FileArchive, PenLine, ChevronRight, Home, Sparkles,
} from 'lucide-react';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    section: string;
}

const contentSections = ['posts', 'categories', 'authors'];

const pageItems: NavItem[] = [
    { label: 'Navegação do site', href: '/admin/menu', icon: Navigation, section: 'menu' },
    { label: 'Sobre', href: '/admin/sobre', icon: Info, section: 'sobre' },
    { label: 'Contato', href: '/admin/contato', icon: Phone, section: 'contato' },
    { label: 'Privacidade & Termos', href: '/admin/legal', icon: Shield, section: 'legal' },
];

interface AdminNavProps {
    activeSection?: string;
    extraItems?: NavItem[];
}

export default function AdminNav({ activeSection = '', extraItems = [] }: AdminNavProps) {
    const inContentSection = contentSections.includes(activeSection);

    return (
        <aside
            className="fixed inset-y-0 left-0 w-64 bg-surface border-r border-border flex flex-col z-50"
            aria-label="Navegação do painel"
            style={{ boxShadow: '1px 0 0 0 rgb(224 218 206)' }}
        >
            {/* Skip link */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-surface focus:rounded focus:text-sm focus:font-semibold"
            >
                Pular para o conteúdo principal
            </a>

            {/* Logo */}
            <div className="h-16 flex items-center px-5 border-b border-border">
                <a
                    href="/admin"
                    aria-label="Ir para o início do painel"
                    className="flex items-center gap-2.5 no-underline"
                >
                    <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shrink-0" aria-hidden="true">
                        <Home className="w-3.5 h-3.5 text-surface" />
                    </div>
                    <span className="font-semibold text-ink text-sm">Meu Painel</span>
                </a>
            </div>

            {/* CTA persistente — Novo artigo */}
            <div className="px-3 pt-4 pb-3 border-b border-border">
                <a
                    href="/admin/posts/new"
                    className="flex items-center justify-center gap-2 w-full bg-primary hover:brightness-90 text-surface rounded px-4 py-2.5 min-h-[44px] text-sm font-semibold transition-all"
                    aria-label="Escrever novo artigo"
                >
                    <PenLine className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Novo artigo
                </a>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Principal">

                {/* Início */}
                <div className="mb-5">
                    <NavLink
                        item={{ label: 'Início', href: '/admin', icon: Home, section: 'dashboard' }}
                        active={activeSection === 'dashboard'}
                    />
                </div>

                {/* Conteúdo */}
                <div className="mb-5" role="group" aria-labelledby="nav-conteudo">
                    <p id="nav-conteudo" className="text-[10px] font-bold text-ink-faint uppercase tracking-widest px-3 mb-1.5">Conteúdo</p>

                    {/* Artigos — sempre visível */}
                    <NavLink
                        item={{ label: 'Artigos', href: '/admin/posts', icon: FileText, section: 'posts' }}
                        active={activeSection === 'posts'}
                    />

                    {/* Sub-itens de Artigos — indentados, sempre visíveis */}
                    <div className="pl-3 mt-0.5 space-y-0.5">
                        <SubNavLink
                            label="Categorias"
                            href="/admin/categories"
                            icon={Tag}
                            active={activeSection === 'categories'}
                        />
                        <SubNavLink
                            label="Autores"
                            href="/admin/authors"
                            icon={Users}
                            active={activeSection === 'authors'}
                        />
                        <SubNavLink
                            label="Gerar com IA"
                            href="/admin/ai"
                            icon={Sparkles}
                            active={activeSection === 'ai'}
                        />
                        {extraItems.map(item => (
                            <SubNavLink
                                key={item.href}
                                label={item.label}
                                href={item.href}
                                icon={item.icon}
                                active={activeSection === item.section}
                            />
                        ))}
                    </div>
                </div>

                {/* Páginas */}
                <div className="mb-5" role="group" aria-labelledby="nav-paginas">
                    <p id="nav-paginas" className="text-[10px] font-bold text-ink-faint uppercase tracking-widest px-3 mb-1.5">Páginas</p>
                    {pageItems.map(item => (
                        <NavLink key={item.href} item={item} active={activeSection === item.section} />
                    ))}
                </div>

                {/* Plugins + Config */}
                <div role="group" aria-labelledby="nav-config">
                    <p id="nav-config" className="text-[10px] font-bold text-ink-faint uppercase tracking-widest px-3 mb-1.5">Configurações</p>
                    <NavLink item={{ label: 'Plugins', href: '/admin/plugins', icon: Package, section: 'plugins' }} active={activeSection === 'plugins'} />
                    <NavLink item={{ label: 'Configurações', href: '/admin/config', icon: Settings, section: 'config' }} active={activeSection === 'config'} />
                    <NavLink item={{ label: 'Backup', href: '/admin/backup', icon: FileArchive, section: 'backup' }} active={activeSection === 'backup'} />
                </div>
            </nav>

            {/* Rodapé */}
            <div className="p-3 border-t border-border space-y-0.5">
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ver site publicado (abre em nova aba)"
                    className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded text-ink-muted hover:text-primary hover:bg-primary-soft transition-colors"
                >
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium">Ver site</span>
                </a>
                <a
                    href="/api/admin/logout"
                    aria-label="Sair do painel"
                    className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded text-ink-muted hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium">Sair</span>
                </a>
            </div>
        </aside>
    );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    const Icon = item.icon;
    return (
        <a
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded mb-0.5 transition-colors ${
                active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:text-ink hover:bg-elev'
            }`}
        >
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-ink-faint'}`} aria-hidden="true" />
            <span className={`text-sm flex-1 ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
            {active && <ChevronRight className="w-3 h-3 text-primary/60" aria-hidden="true" />}
        </a>
    );
}

function SubNavLink({ label, href, icon: Icon, active }: { label: string; href: string; icon: React.ElementType; active: boolean }) {
    return (
        <a
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded transition-colors text-xs ${
                active ? 'bg-primary-soft text-primary font-semibold' : 'text-ink-faint hover:text-ink-muted hover:bg-elev font-medium'
            }`}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {label}
        </a>
    );
}
