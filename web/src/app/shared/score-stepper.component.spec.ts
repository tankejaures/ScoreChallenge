import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScoreStepperComponent } from './score-stepper.component';

describe('ScoreStepperComponent', () => {
  let fixture: ComponentFixture<ScoreStepperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ScoreStepperComponent] }).compileComponents();
    fixture = TestBed.createComponent(ScoreStepperComponent);
    fixture.componentRef.setInput('label', 'France');
    fixture.detectChanges();
  });

  it('starts at 0 and increments', () => {
    const component = fixture.componentInstance;
    expect(component.value()).toBe(0);
    component.increment();
    expect(component.value()).toBe(1);
  });

  it('never goes below 0 nor above 99', () => {
    const component = fixture.componentInstance;
    component.decrement();
    expect(component.value()).toBe(0);
    component.value.set(99);
    component.increment();
    expect(component.value()).toBe(99);
  });
});
