"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface VADocumentData {
  documentType: "RDL" | "Not RDL";
  skip?: boolean;
  client?: {
    name?: string;
    branch: string;
    serviceStart: string;
    serviceEnd: string;
    era: string | string[];
  };
  claim?: {
    receivedDate: string;
    conditions: Array<{
      name: string;
      adjudication: "Granted" | "Denied" | "Deferred" | "Continued";
      effectiveDate: string;
      evaluationPercent: number;
      symptoms: string[];
      reasoning: string;
      cfrCitations: string[];
    }>;
  };
  evidence: string[];
  confirmedPacket: boolean | "unknown";
  combinedRating?: number;
  combinedFromConditions?: boolean;
}

export default function DocumentView() {
  const params = useParams();
  const [document, setDocument] = useState<any>(null);
  const [data, setData] = useState<VADocumentData | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("processedDocuments");
    if (saved) {
      const documents = JSON.parse(saved);
      const doc = documents.find((d: any) => d.id === params.id);
      if (doc) {
        setDocument(doc);
        try {
          const parsed = JSON.parse(doc.result);
          setData(parsed);
        } catch (e) {}
      }
    }
  }, [params.id]);

  if (!document) {
    return <div className="p-8">Document not found</div>;
  }

  if (!data) {
    return (
      <div className="p-8">
        <h1>Debug Info</h1>
        <p>Document: {document.fileName}</p>
        <p>Status: {document.status}</p>
        <pre className="bg-gray-100 p-4 mt-4 text-xs overflow-auto">
          {document.result}
        </pre>
      </div>
    );
  }

  if (data.documentType === "Not RDL") {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Document Analysis
          </h1>
          <p className="text-gray-600">
            This document is not a VA Rating Decision Letter.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            File: {document.fileName}
          </p>
        </div>
      </div>
    );
  }

  const grantedConditions =
    data.claim?.conditions?.filter((c) => c.adjudication === "Granted") || [];
  const totalRating = Math.min(
    100,
    data.combinedRating ||
      grantedConditions.reduce((sum, c) => sum + (c.evaluationPercent || 0), 0)
  );

  // Frontend validation of packet completeness
  const requiredDocs = [
    {
      name: "DD Form 214 (Certificate of Release or Discharge from Active Duty)",
      found: data.evidence?.some(
        (e) => e.toLowerCase().includes("dd") && e.toLowerCase().includes("214")
      ),
    },
    {
      name: "VA Form 21-526EZ (Application for Disability Compensation and Related Benefits)",
      found: data.evidence?.some(
        (e) =>
          e.toLowerCase().includes("21") &&
          e.toLowerCase().includes("526") &&
          (e.toLowerCase().includes("ez") || e.toLowerCase().includes("EZ"))
      ),
    },
    {
      name: "C&P Exam/DBQ (Disability Benefits Questionnaire)",
      found: data.evidence?.some(
        (e) =>
          e.toLowerCase().includes("c&p") ||
          e.toLowerCase().includes("c p") ||
          e.toLowerCase().includes("compensation and pension") ||
          e.toLowerCase().includes("dbq") ||
          e.toLowerCase().includes("disability benefits questionnaire") ||
          e.toLowerCase().includes("disability benefit questionnaire")
      ),
    },
    {
      name: "Service Treatment Records (STR/Service Medical Records)",
      found: data.evidence?.some(
        (e) =>
          e.toLowerCase().includes("str") ||
          (e.toLowerCase().includes("service") &&
            (e.toLowerCase().includes("treatment") ||
              e.toLowerCase().includes("medical")) &&
            e.toLowerCase().includes("record"))
      ),
    },
    {
      name: "VA Form 21-0781/21-4138 (Statement in Support of Claim)",
      found: data.evidence?.some(
        (e) =>
          e.toLowerCase().includes("statement") &&
          (e.toLowerCase().includes("support") ||
            e.toLowerCase().includes("form") ||
            e.toLowerCase().includes("21-0781") ||
            e.toLowerCase().includes("21-4138") ||
            e.toLowerCase().includes("personal") ||
            e.toLowerCase().includes("stressor"))
      ),
    },
  ];
  const actuallyComplete = requiredDocs.every((doc) => doc.found);
  const packetStatus = actuallyComplete ? "Complete" : "Incomplete";

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen print:p-4">
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-6 mb-8">
        <h1 className="text-3xl text-nowrap font-bold text-gray-900 mb-2">
          VA Rating Decision Summary :{" "}
          {data.client && data.client?.name && data.client.name}
        </h1>
        <p className="text-gray-600">Document: {document.fileName}</p>
        <p className="text-sm text-gray-500">
          Processed: {new Date(document.timestamp).toLocaleDateString()}
        </p>
      </div>

      {/* Veteran Information */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">
            Veteran Information
          </h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Branch:</span>{" "}
              {data.client?.branch || "N/A"}
            </p>
            <p>
              <span className="font-medium">Service Period:</span>{" "}
              {data.client?.serviceStart} - {data.client?.serviceEnd}
            </p>
            <p>
              <span className="font-medium">Era:</span>{" "}
              {data.client?.era
                ? Array.isArray(data.client.era)
                  ? data.client.era.join(" | ")
                  : data.client.era
                : "N/A"}
            </p>
          </div>
        </div>

        <div
          className={`p-6 rounded-lg ${
            actuallyComplete ? "bg-green-50" : "bg-red-50"
          }`}
        >
          <h2
            className={`text-xl font-semibold mb-4 ${
              actuallyComplete ? "text-green-900" : "text-red-900"
            }`}
          >
            Claim Summary
          </h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Received:</span>{" "}
              {data.claim?.receivedDate || "N/A"}
            </p>
            <p>
              <span className="font-medium">Total Rating:</span> {totalRating}%
            </p>
            <p>
              <span className="font-medium">Packet Status:</span>
              <span
                className={`ml-2 px-2 py-1 text-xs rounded ${
                  actuallyComplete
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {packetStatus}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Conditions - Only show if packet is complete */}
      {actuallyComplete && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Disability Conditions
          </h2>
          <div className="space-y-4">
            {data.claim?.conditions?.map((condition, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {condition.name}
                  </h3>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${
                        condition.adjudication === "Granted"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {condition.adjudication}
                    </span>
                    {condition.adjudication === "Granted" &&
                      condition.evaluationPercent !== undefined &&
                      condition.evaluationPercent !== null && (
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {condition.evaluationPercent}%
                        </p>
                      )}
                  </div>
                </div>

                {condition.effectiveDate && (
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Effective Date:</span>{" "}
                    {condition.effectiveDate}
                  </p>
                )}

                {condition.reasoning && (
                  <div className="mb-4">
                    <p className="font-medium text-gray-900 mb-2">Reasoning:</p>
                    <p className="text-gray-700">{condition.reasoning}</p>
                  </div>
                )}

                {condition.symptoms && condition.symptoms.length > 0 && (
                  <div className="mb-4">
                    <p className="font-medium text-gray-900 mb-2">Symptoms:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {condition.symptoms.map((symptom, i) => (
                        <li key={i}>{symptom}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {condition.cfrCitations &&
                  condition.cfrCitations.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-900 mb-2">
                        CFR Citations:
                      </p>
                      <p className="text-sm text-gray-600">
                        {condition.cfrCitations.join(", ")}
                      </p>
                    </div>
                  )}
              </div>
            )) || <p className="text-gray-500">No conditions found</p>}
          </div>
        </div>
      )}

      {/* Show warning message when packet is incomplete */}
      {!actuallyComplete && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-3">
            ⚠️ Incomplete Document Packet
          </h2>
          <p className="text-yellow-700 mb-4">
            The disability conditions section is hidden because required
            evidence documents are missing. Please ensure all required documents
            are present for a complete analysis.
          </p>
          <p className="text-sm text-yellow-600">
            Missing documents are listed in the Evidence Analysis section below.
          </p>
        </div>
      )}

      {/* Evidence */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Evidence Analysis
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Evidence Present */}
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              Evidence Reviewed
            </h3>
            <ul className="space-y-2">
              {data.evidence?.map((item, idx) => (
                <li key={idx} className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  <div>
                    <div className="text-gray-900">{item}</div>
                    <div className="text-xs text-gray-500">
                      Processed:{" "}
                      {new Date(document.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              )) || <li className="text-gray-500">No evidence listed</li>}
            </ul>
          </div>

          {/* Evidence Missing */}
          <div className="bg-red-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-red-900 mb-4">
              Evidence Missing
            </h3>
            <ul className="space-y-2">
              {requiredDocs
                .filter((doc) => !doc.found)
                .map((doc, idx) => (
                  <li key={idx} className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                    <div>
                      <div className="text-gray-900">{doc.name}</div>
                      <div className="text-xs text-gray-500">
                        Required for complete packet
                      </div>
                    </div>
                  </li>
                ))}
              {requiredDocs.every((doc) => doc.found) && (
                <li className="text-green-600 font-medium">
                  All required documents present
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Print Button */}
      <div className="text-center print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Save as PDF
        </button>
      </div>
    </div>
  );
}
