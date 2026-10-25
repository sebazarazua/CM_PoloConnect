import {it,expect} from 'vitest';
import {SkillRegistry} from '../src/skills/runtime.js';
it('SkillCore removes only discovery metadata/reference indexes and preserves editorial hard gates',()=>{
 const bundle=new SkillRegistry().load('copywriter');
 expect(bundle.instructions).not.toContain('description:');expect(bundle.instructions).not.toContain('## Required references');
 expect(bundle.instructions).toContain('## Hard gates');expect(bundle.instructions).toContain('## Core principles');expect(bundle.instructions).toContain('## Workflow');
});
