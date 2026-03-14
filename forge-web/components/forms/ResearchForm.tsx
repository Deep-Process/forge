"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { researchCreateSchema, researchUpdateSchema, type ResearchCreateForm, type ResearchUpdateForm } from "@/lib/schemas/research";
import { createResearch, updateResearch } from "@/stores/researchStore";
import { parseValidationErrors, fieldErrorsToRecord } from "@/lib/utils/apiErrors";
import { FormDrawer } from "./FormDrawer";
import { TextField } from "./TextField";
import { TextAreaField } from "./TextAreaField";
import { SelectField, type SelectOption } from "./SelectField";
import { MultiSelectField } from "./MultiSelectField";
import { DynamicListField } from "./DynamicListField";
import { FormErrorSummary } from "./FormErrorSummary";
import type { Research } from "@/lib/types";
import type { FieldError } from "@/lib/utils/apiErrors";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "architecture", label: "Architecture" },
  { value: "business", label: "Business" },
  { value: "domain", label: "Domain" },
  { value: "feasibility", label: "Feasibility" },
  { value: "risk", label: "Risk" },
  { value: "technical", label: "Technical" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUPERSEDED", label: "Superseded" },
  { value: "ARCHIVED", label: "Archived" },
];

const LINKED_ENTITY_OPTIONS: SelectOption[] = [
  { value: "", label: "(none)" },
  { value: "objective", label: "Objective" },
  { value: "idea", label: "Idea" },
];

const SCOPE_OPTIONS: SelectOption[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "database", label: "Database" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "performance", label: "Performance" },
  { value: "security", label: "Security" },
  { value: "ai", label: "AI" },
  { value: "ux", label: "UX" },
];

interface ResearchFormProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  research?: Research;
  onSuccess?: () => void;
}

export function ResearchForm({ slug, open, onClose, research, onSuccess }: ResearchFormProps) {
  const isEdit = !!research;
  const [submitting, setSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<FieldError[]>([]);

  const createForm = useForm<ResearchCreateForm>({
    resolver: zodResolver(researchCreateSchema),
    defaultValues: {
      title: "",
      topic: "",
      category: "technical",
      summary: "",
      linked_entity_type: undefined,
      linked_entity_id: "",
      content: "",
      key_findings: [],
      decision_ids: [],
      scopes: [],
      tags: [],
    },
  });

  const editForm = useForm<ResearchUpdateForm>({
    resolver: zodResolver(researchUpdateSchema),
    defaultValues: {
      title: research?.title || "",
      topic: research?.topic || "",
      status: research?.status,
      category: research?.category,
      summary: research?.summary || "",
      key_findings: research?.key_findings || [],
      decision_ids: research?.decision_ids || [],
      scopes: research?.scopes || [],
      tags: research?.tags || [],
    },
  });

  useEffect(() => {
    if (isEdit) {
      editForm.reset({
        title: research?.title || "",
        topic: research?.topic || "",
        status: research?.status,
        category: research?.category,
        summary: research?.summary || "",
        key_findings: research?.key_findings || [],
        decision_ids: research?.decision_ids || [],
        scopes: research?.scopes || [],
        tags: research?.tags || [],
      });
    } else {
      createForm.reset({
        title: "",
        topic: "",
        category: "technical",
        summary: "",
        linked_entity_type: undefined,
        linked_entity_id: "",
        content: "",
        key_findings: [],
        decision_ids: [],
        scopes: [],
        tags: [],
      });
    }
    setApiErrors([]);
  }, [research, isEdit, createForm, editForm]);

  const handleError = (e: unknown) => {
    const errors = parseValidationErrors(e);
    if (errors.length > 0) {
      setApiErrors(errors);
      const record = fieldErrorsToRecord(errors);
      for (const [field, message] of Object.entries(record)) {
        if (isEdit) {
          editForm.setError(field as keyof ResearchUpdateForm, { message });
        } else {
          createForm.setError(field as keyof ResearchCreateForm, { message });
        }
      }
    } else {
      setApiErrors([{ field: "general", message: (e as Error).message }]);
    }
  };

  const onCreateSubmit = createForm.handleSubmit(async (data) => {
    setSubmitting(true);
    setApiErrors([]);
    try {
      await createResearch(slug, [data]);
      createForm.reset();
      onSuccess?.();
      onClose();
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  });

  const onEditSubmit = editForm.handleSubmit(async (data) => {
    setSubmitting(true);
    setApiErrors([]);
    try {
      await updateResearch(slug, research!.id, data);
      editForm.reset();
      onSuccess?.();
      onClose();
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  });

  if (isEdit) {
    return (
      <FormDrawer
        open={open}
        onClose={onClose}
        title={`Edit ${research.id}`}
        onSubmit={onEditSubmit}
        submitting={submitting}
        submitLabel="Update"
      >
        <FormErrorSummary errors={apiErrors} />
        <TextField name="title" control={editForm.control} label="Title" placeholder="Research title" />
        <TextField name="topic" control={editForm.control} label="Topic" placeholder="Research topic" />
        <SelectField name="category" control={editForm.control} label="Category" options={CATEGORY_OPTIONS} />
        <SelectField name="status" control={editForm.control} label="Status" options={STATUS_OPTIONS} />
        <TextAreaField name="summary" control={editForm.control} label="Summary" placeholder="Research summary" rows={4} />
        <DynamicListField name="key_findings" control={editForm.control} label="Key Findings" addLabel="Add finding" placeholder="Key finding" />
        <DynamicListField name="decision_ids" control={editForm.control} label="Decision IDs" addLabel="Add decision" placeholder="D-001" />
        <MultiSelectField name="scopes" control={editForm.control} label="Scopes" options={SCOPE_OPTIONS} />
        <DynamicListField name="tags" control={editForm.control} label="Tags" addLabel="Add tag" placeholder="e.g., caching, api" />
      </FormDrawer>
    );
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Create Research"
      onSubmit={onCreateSubmit}
      submitting={submitting}
      submitLabel="Create"
    >
      <FormErrorSummary errors={apiErrors} />
      <TextField name="title" control={createForm.control} label="Title" required placeholder="Research title" />
      <TextField name="topic" control={createForm.control} label="Topic" required placeholder="Research topic" />
      <SelectField name="category" control={createForm.control} label="Category" options={CATEGORY_OPTIONS} />
      <TextAreaField name="summary" control={createForm.control} label="Summary" required placeholder="Research summary" rows={4} />
      <SelectField name="linked_entity_type" control={createForm.control} label="Linked Entity Type" options={LINKED_ENTITY_OPTIONS} />
      <TextField name="linked_entity_id" control={createForm.control} label="Linked Entity ID" placeholder="O-001, I-001..." />
      <TextAreaField name="content" control={createForm.control} label="Content (Markdown)" placeholder="Full research content" rows={8} />
      <DynamicListField name="key_findings" control={createForm.control} label="Key Findings" addLabel="Add finding" placeholder="Key finding" />
      <DynamicListField name="decision_ids" control={createForm.control} label="Decision IDs" addLabel="Add decision" placeholder="D-001" />
      <MultiSelectField name="scopes" control={createForm.control} label="Scopes" options={SCOPE_OPTIONS} />
      <DynamicListField name="tags" control={createForm.control} label="Tags" addLabel="Add tag" placeholder="e.g., caching, api" />
    </FormDrawer>
  );
}
