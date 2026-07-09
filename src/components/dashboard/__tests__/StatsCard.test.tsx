import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsCard from '../StatsCard';
import { FolderKanban } from 'lucide-react';

describe('StatsCard Component', () => {
  const defaultProps = {
    title: 'Active Projects',
    value: 5,
    icon: <FolderKanban data-testid="test-icon" />,
  };

  it('should render the title and value', () => {
    render(<StatsCard {...defaultProps} />);

    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should render the unit when provided', () => {
    render(<StatsCard {...defaultProps} unit="pcs" />);

    expect(screen.getByText('pcs')).toBeInTheDocument();
  });

  it('should display the target when target is provided', () => {
    render(<StatsCard {...defaultProps} target={10} unit="pcs" />);

    expect(screen.getByText('Target: 10 pcs')).toBeInTheDocument();
  });

  it('should display the up trend indicator', () => {
    render(<StatsCard {...defaultProps} trend="up" />);

    const trend = screen.getByText('↑');
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveClass('text-success');
  });

  it('should display the down trend indicator', () => {
    render(<StatsCard {...defaultProps} trend="down" />);

    const trend = screen.getByText('↓');
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveClass('text-error');
  });
});
