import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Account, Category } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
import {
  detectAmountFormat,
  detectDateFormat,
  parseCSV,
} from '../utils/importParsing';
import {
  autoMapImportColumns,
  buildImportPublishPayload,
  buildInitialImportEntityMaps,
  processConfiguredImportData,
} from '../utils/importWizardModel';
import {
  StepClean,
  StepColumns,
  StepConfirm,
  StepMap,
  StepPreview,
  StepUpload,
} from './import/ImportWizardSteps';
import { Button } from './ui/Actions';
import { FullPanel } from './ui/Overlays';

interface ImportWizardProps {
  importType: 'transactions' | 'accounts';
  onClose: () => void;
  onPublish: (
    items: any[],
    dataType: 'transactions' | 'accounts',
    fileName: string,
    originalData: Record<string, any>[],
    errors: Record<number, Record<string, string>>,
    newAccounts?: Account[],
  ) => void;
  existingAccounts: Account[];
  allCategories: Category[];
}

const STEPS = [
  { number: 1, name: 'Upload' },
  { number: 2, name: 'Configure' },
  { number: 3, name: 'Preview' },
  { number: 4, name: 'Clean' },
  { number: 5, name: 'Map' },
  { number: 6, name: 'Confirm' },
];

const ImportWizard: React.FC<ImportWizardProps> = ({
  importType,
  onClose,
  onPublish,
  existingAccounts,
  allCategories,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [rawCSV, setRawCSV] = useState('');
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [delimiter, setDelimiter] = useState(',');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [amountConfig, setAmountConfig] = useState('single_signed');
  const [accountSource, setAccountSource] = useState<'column' | 'single'>('column');
  const [selectedSingleAccountId, setSelectedSingleAccountId] = useState<string>(
    existingAccounts.length > 0 ? existingAccounts[0].id : '',
  );
  const [cleanedData, setCleanedData] = useState<any[]>([]);
  const [dataErrors, setDataErrors] = useState<Record<number, Record<string, string>>>({});
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [accountTypeMap, setAccountTypeMap] = useState<Record<string, string>>({});
  const [currencyMap, setCurrencyMap] = useState<Record<string, string>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [isOpen, setOpen] = useState(true);
  const hasParsed = useRef(false);
  const isPhone = useIsMobile();

  const handleProcessUpload = useCallback(() => {
    const { headers, data } = parseCSV(rawCSV, delimiter);
    setCsvHeaders(headers);
    setParsedData(data);
    setColumnMap(autoMapImportColumns(headers, importType));
  }, [rawCSV, importType, delimiter]);

  // Only a new file or delimiter parses again, so manual column choices survive moving between steps.
  useEffect(() => {
    if (rawCSV && hasParsed.current) handleProcessUpload();
  }, [handleProcessUpload, rawCSV]);

  useEffect(() => {
    if (parsedData.length > 0 && importType === 'transactions') {
      setDateFormat(detectDateFormat(parsedData, columnMap.date));
      setAmountConfig(detectAmountFormat(columnMap));
    }
  }, [parsedData, columnMap, importType]);

  const processConfiguredData = () => {
    const { cleaned, errors } = processConfiguredImportData({
      parsedData,
      columnMap,
      importType,
      dateFormat,
      amountConfig,
      accountSource,
      selectedSingleAccountId,
      existingAccounts,
    });
    setDataErrors(errors);
    setCleanedData(cleaned);
    setCategoryMap({});
    setAccountMap({});
    setAccountTypeMap({});
    setCurrencyMap({});
  };

  const handleProcessCleaning = () => {
    const initialMaps = buildInitialImportEntityMaps({
      cleanedData,
      excludedRows,
      importType,
      accountSource,
      allCategories,
      existingAccounts,
    });
    setCurrencyMap(initialMaps.currencyMap);
    setCategoryMap(initialMaps.categoryMap);
    setAccountMap(initialMaps.accountMap);
    setAccountTypeMap(initialMaps.accountTypeMap);
  };

  const goToStep = (step: number) => {
    if (step > currentStep) {
      if (currentStep === 1) {
        if (!rawCSV) return;
        hasParsed.current = true;
        handleProcessUpload();
      }
      if (currentStep === 2) processConfiguredData();
      if (currentStep === 4) handleProcessCleaning();
    }
    setCurrentStep(step);
  };

  const handlePublish = () => {
    const { dataToPublish, newAccountsToCreate } = buildImportPublishPayload({
      importType,
      accountSource,
      cleanedData,
      excludedRows,
      accountMap,
      categoryMap,
      accountTypeMap,
      currencyMap,
    });
    const publishedRawRows = parsedData.filter((_, idx) => !excludedRows.has(idx));
    setIsPublishing(true);
    onPublish(dataToPublish, importType, fileName, publishedRawRows, dataErrors, newAccountsToCreate);
    setTimeout(() => onClose(), 2000);
  };

  const close = () => {
    setOpen(false);
    onClose();
  };

  const renderContent = () => {
    if (isPublishing) {
      return <p className="type-body py-12 text-center text-muted">Importing. You can close this panel.</p>;
    }
    switch (currentStep) {
      case 1:
        return <StepUpload setRawCSV={setRawCSV} setFileName={setFileName} fileName={fileName} />;
      case 2:
        return (
          <StepColumns
            headers={csvHeaders}
            columnMap={columnMap}
            setColumnMap={setColumnMap}
            importType={importType}
            dateFormat={dateFormat}
            setDateFormat={setDateFormat}
            amountConfig={amountConfig}
            setAmountConfig={setAmountConfig}
            delimiter={delimiter}
            setDelimiter={setDelimiter}
            accountSource={accountSource}
            setAccountSource={setAccountSource}
            selectedSingleAccountId={selectedSingleAccountId}
            setSelectedSingleAccountId={setSelectedSingleAccountId}
            existingAccounts={existingAccounts}
          />
        );
      case 3:
        return (
          <StepPreview
            parsedData={parsedData}
            cleanedData={cleanedData}
            dataErrors={dataErrors}
            columnMap={columnMap}
            importType={importType}
          />
        );
      case 4:
        return (
          <StepClean
            data={cleanedData}
            setData={setCleanedData}
            excludedRows={excludedRows}
            setExcludedRows={setExcludedRows}
            isSimple={isPhone}
          />
        );
      case 5:
        return (
          <StepMap
            importType={importType}
            categoryMap={categoryMap}
            setCategoryMap={setCategoryMap}
            allCategories={allCategories}
            accountMap={accountMap}
            setAccountMap={setAccountMap}
            existingAccounts={existingAccounts}
            accountTypeMap={accountTypeMap}
            setAccountTypeMap={setAccountTypeMap}
            currencyMap={currencyMap}
            setCurrencyMap={setCurrencyMap}
          />
        );
      case 6:
        return (
          <StepConfirm
            count={cleanedData.filter(row => !excludedRows.has(row.originalIndex)).length}
            importType={importType}
            errorCount={Object.keys(dataErrors).length}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FullPanel
      isOpen={isOpen}
      onClose={close}
      isDirty={!!rawCSV && !isPublishing}
      title={importType === 'transactions' ? 'Import transactions' : 'Import accounts'}
      description={`Step ${currentStep} of ${STEPS.length}: ${STEPS[currentStep - 1].name}`}
      footer={!isPublishing && (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          {currentStep > 1 && <Button variant="ghost" onPress={() => goToStep(currentStep - 1)}>Back</Button>}
          {currentStep < STEPS.length
            ? <Button isDisabled={currentStep === 1 && !rawCSV} onPress={() => goToStep(currentStep + 1)}>Next</Button>
            : <Button onPress={handlePublish}>Import</Button>}
        </div>
      )}
    >
      <div className="mx-auto max-w-5xl">
        <ol aria-label="Import steps" className="mb-6 hidden gap-1 md:flex">
          {STEPS.map(step => {
            const isDone = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            return (
              <li key={step.number} aria-current={isCurrent ? 'step' : undefined} className="flex-1">
                <span className={cn('block h-1 rounded-full', isDone || isCurrent ? 'bg-pine' : 'bg-inset')} />
                <span className={cn('type-caption mt-1.5 block', isCurrent ? 'text-ink' : 'text-muted')}>{step.name}</span>
              </li>
            );
          })}
        </ol>
        {renderContent()}
      </div>
    </FullPanel>
  );
};

export default ImportWizard;
