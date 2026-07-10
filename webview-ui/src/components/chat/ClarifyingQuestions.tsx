import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { ClarifyingQuestion, ClarifyingAnswer } from '@/types';

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-secondary, #0d1117)',
  border: '1px solid var(--color-border, #30363d)',
  borderRadius: 'var(--radius-md, 8px)',
  padding: 16,
  margin: '6px 0',
  maxHeight: '50vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const slideContainerStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  overflow: 'hidden',
  minHeight: 120,
};

const slideStyle: CSSProperties = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
  opacity: 0,
  transform: 'translateX(20px)',
  pointerEvents: 'none',
};

const activeSlideStyle: CSSProperties = {
  ...slideStyle,
  opacity: 1,
  transform: 'translateX(0)',
  pointerEvents: 'auto',
};

const buttonStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-sm, 6px)',
  fontWeight: 'var(--font-weight-semibold, 600)',
  cursor: 'pointer',
  border: 'none',
  fontSize: 'var(--font-size-sm, 13px)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 0.2s',
};

export function ClarifyingQuestions({
  questions,
  onSubmit,
}: {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: ClarifyingAnswer[]) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  // Initialize first question's default selection
  useEffect(() => {
    if (questions.length > 0 && questions[0].options.length > 0) {
      setSelected((prev) => ({
        ...prev,
        [questions[0].id]: questions[0].options[0],
      }));
    }
  }, [questions]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const hasAnswer = selected[currentQuestion?.id] || custom[currentQuestion?.id]?.trim();

  const handleNext = () => {
    if (!hasAnswer) return;
    
    if (isLastQuestion) {
      // Submit all answers
      const answers: ClarifyingAnswer[] = questions.map((q) => {
        const useCustom = q.allowCustom && custom[q.id]?.trim();
        return {
          questionId: q.id,
          selectedOption: useCustom ? undefined : selected[q.id] ?? q.options[0],
          customText: useCustom ? custom[q.id].trim() : undefined,
        };
      });
      onSubmit(answers);
    } else {
      setDirection('next');
      setCurrentIndex((prev) => prev + 1);
      // Pre-select next question's default option
      const nextQuestion = questions[currentIndex + 1];
      if (nextQuestion?.options.length > 0) {
        setSelected((prev) => ({
          ...prev,
          [nextQuestion.id]: nextQuestion.options[0],
        }));
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setDirection('prev');
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelected((prev) => ({ ...prev, [questionId]: option }));
    // Clear custom input when selecting an option
    setCustom((prev) => ({ ...prev, [questionId]: '' }));
  };

  const handleCustomChange = (questionId: string, value: string) => {
    setCustom((prev) => ({ ...prev, [questionId]: value }));
    // Clear selected option when typing custom input
    setSelected((prev) => ({ ...prev, [questionId]: '' }));
  };

  if (!currentQuestion) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'var(--font-weight-bold, 700)', fontSize: 'var(--font-size-base, 14px)', color: 'var(--color-text-primary, #e6e6e6)' }}>
          Уточняющие вопросы
        </div>
        <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--color-text-secondary, #8b949e)' }}>
          {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: 'var(--color-border, #30363d)',
        borderRadius: 2,
        marginBottom: 16,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          background: 'var(--color-primary, #7c6af7)',
          transition: 'width 0.3s ease-out',
        }} />
      </div>

      {/* Slide container */}
      <div style={slideContainerStyle}>
        {questions.map((q, idx) => {
          const isActive = idx === currentIndex;
          const slideTransform = direction === 'next' 
            ? (idx < currentIndex ? 'translateX(-20px)' : 'translateX(20px)')
            : (idx > currentIndex ? 'translateX(20px)' : 'translateX(-20px)');
          
          return (
            <div
              key={q.id}
              style={{
                ...slideStyle,
                ...(isActive ? activeSlideStyle : {}),
                ...(isActive ? {} : { transform: slideTransform }),
              }}
            >
              <div style={{ fontSize: 'var(--font-size-base, 14px)', color: 'var(--color-text-primary, #e6e6e6)', marginBottom: 12, fontWeight: 'var(--font-weight-medium, 500)' }}>
                {q.question}
              </div>

              {q.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 'var(--font-size-sm, 13px)',
                        color: 'var(--color-text-primary, #e6e6e6)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm, 6px)',
                        cursor: 'pointer',
                        border: '1px solid var(--color-border, #30363d)',
                        background: selected[q.id] === opt ? 'rgba(124, 106, 247, 0.1)' : 'transparent',
                        borderColor: selected[q.id] === opt ? 'var(--color-primary, #7c6af7)' : 'var(--color-border, #30363d)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (selected[q.id] !== opt) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selected[q.id] !== opt) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected[q.id] === opt}
                        onChange={() => handleOptionSelect(q.id, opt)}
                        style={{ accentColor: 'var(--color-primary, #7c6af7)' }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.allowCustom && (
                <input
                  type="text"
                  value={custom[q.id] ?? ''}
                  onChange={(e) => handleCustomChange(q.id, e.target.value)}
                  placeholder="Свой вариант…"
                  style={{
                    width: '100%',
                    marginTop: q.options.length ? 10 : 0,
                    padding: 10,
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontSize: 'var(--font-size-sm, 13px)',
                    background: '#010409',
                    border: custom[q.id] ? '1px solid var(--color-primary, #7c6af7)' : '1px solid var(--color-border, #30363d)',
                    color: 'var(--color-text-primary, #e6e6e6)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 8 }}>
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          style={{
            ...buttonStyle,
            background: currentIndex === 0 ? 'var(--color-border, #30363d)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.03))',
            color: currentIndex === 0 ? 'var(--color-text-secondary, #8b949e)' : 'var(--color-text-primary, #e6e6e6)',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={16} />
          Назад
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!hasAnswer}
          style={{
            ...buttonStyle,
            background: hasAnswer ? 'var(--color-primary, #7c6af7)' : 'var(--color-border, #30363d)',
            color: hasAnswer ? '#fff' : 'var(--color-text-secondary, #8b949e)',
            cursor: hasAnswer ? 'pointer' : 'not-allowed',
            opacity: hasAnswer ? 1 : 0.5,
          }}
        >
          {isLastQuestion ? (
            <>
              <Check size={16} />
              Завершить
            </>
          ) : (
            <>
              Далее
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
