import React from 'react';

// 内容区块的属性接口
export interface ContentSectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

// 内容区块组件
export const ContentSection: React.FC<ContentSectionProps> = ({ 
  children, 
  id = '', 
  className = '', 
  style 
}) => (
  <section 
    id={id} 
    className={`scroll-mt-16 ${className}`}
    style={style}
  >
    {children}
  </section>
);