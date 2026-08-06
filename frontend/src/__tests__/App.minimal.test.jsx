import React from 'react';

test('renders a simple React element', () => {
  const element = <div>Hello World</div>;
  expect(element).toBeTruthy();
});

test('React component has correct props', () => {
  const element = <div className="test" data-testid="test-element">Content</div>;
  expect(element.props.className).toBe('test');
  expect(element.props.children).toBe('Content');
});