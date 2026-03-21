import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Pagination from './Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Components/Molecular/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Reusable pagination controls for admin tables.' } },
  },
  argTypes: {
    onPageChange: { action: 'pageChanged' },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  args: {
    currentPage: 0,
    totalItems: 100,
    pageSize: 25,
    testId: 'pagination',
  },
};

export const MiddlePage: Story = {
  args: {
    currentPage: 2,
    totalItems: 200,
    pageSize: 50,
    testId: 'pagination',
  },
};

export const LastPage: Story = {
  args: {
    currentPage: 3,
    totalItems: 100,
    pageSize: 25,
    testId: 'pagination',
  },
};

export const SinglePage: Story = {
  args: {
    currentPage: 0,
    totalItems: 10,
    pageSize: 25,
    testId: 'pagination',
  },
};
