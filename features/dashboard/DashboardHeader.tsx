import React from 'react';
import PageHeader from '../../components/PageHeader';
import HeaderButton from '../../components/HeaderButton';

export interface DashboardHeaderProps {
    isEditMode: boolean;
    setIsEditMode: (val: boolean) => void;
    setIsAddWidgetModalOpen: (val: boolean) => void;
    isSyncingBanks?: boolean;
    onSyncBanks?: () => void | Promise<void>;
    handleOpenTransactionModal: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    isEditMode,
    setIsEditMode,
    setIsAddWidgetModalOpen,
    isSyncingBanks,
    onSyncBanks,
    handleOpenTransactionModal,
}) => {
    return (
        <div className="mb-6 mt-2 md:mt-0">
            <PageHeader
                markerIcon="analytics"
                markerLabel="Command Center"
                title="Dashboard"
                subtitle="Real-time financial pulse across accounts, investments, and commitments."
                actions={
                    <div className="flex items-center gap-2">
                        <HeaderButton
                            variant={isEditMode ? 'primary' : 'ghost'}
                            icon={isEditMode ? 'done' : 'dashboard_customize'}
                            onClick={() => setIsEditMode(!isEditMode)}
                            title={isEditMode ? 'Finish Editing' : 'Edit Layout'}
                        >
                            {isEditMode ? 'Finish Editing' : 'Customize'}
                        </HeaderButton>

                        {isEditMode && (
                            <HeaderButton
                                variant="secondary"
                                icon="add_circle"
                                onClick={() => setIsAddWidgetModalOpen(true)}
                            >
                                Add Widget
                            </HeaderButton>
                        )}

                        <HeaderButton
                            variant="emerald"
                            icon="sync"
                            isLoading={isSyncingBanks}
                            onClick={() => {
                                if (onSyncBanks) {
                                    onSyncBanks();
                                } else {
                                    const syncBtn = document.querySelector('[data-eb-sync-all]');
                                    if (syncBtn) (syncBtn as HTMLElement).click();
                                }
                            }}
                            title="Sync Connected Banks"
                        >
                            {isSyncingBanks ? 'Syncing...' : 'Sync Banks'}
                        </HeaderButton>

                        <HeaderButton
                            variant="primary"
                            icon="add"
                            onClick={() => handleOpenTransactionModal()}
                        >
                            Add Transaction
                        </HeaderButton>
                    </div>
                }
            />
        </div>
    );
};

export default DashboardHeader;
