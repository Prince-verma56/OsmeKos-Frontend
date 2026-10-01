'use client';

import { useId } from 'react';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type ControllerRenderProps,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { cn } from '@/lib/cn';
import { useUnsavedChanges } from '@/lib/unsaved';
import { SaveBar } from './SaveBar';

export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  defaultValues: DefaultValues<z.input<TSchema>>
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });
}

export function Form<TInput extends FieldValues, TOutput extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  actions,
  guard = true,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  onSubmit: SubmitHandler<TOutput>;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  guard?: boolean;
}) {
  const id = useId();
  const dirty = guard && form.formState.isDirty && !form.formState.isSubmitSuccessful;
  useUnsavedChanges(id, dirty);

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className={className}>
        {children}
        {actions && <SaveBar dirty={dirty}>{actions}</SaveBar>}
      </form>
    </FormProvider>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
  aside,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card shadow-xs', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-medium tracking-wide text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  name,
  label,
  hint,
  required,
  className,
  render,
}: {
  name: TName;
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  render: (field: ControllerRenderProps<TValues, TName> & { id: string; invalid: boolean }) => React.ReactElement;
}) {
  const { control } = useFormContext<TValues>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('block', className)}>
          <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {render({ ...field, id, invalid: Boolean(fieldState.error) })}
          {fieldState.error ? (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {fieldState.error.message}
            </p>
          ) : (
            hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
          )}
        </div>
      )}
    />
  );
}
