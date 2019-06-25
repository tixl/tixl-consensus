import React from 'react';
import classnames from 'classnames';

const Pill: React.FC<{ className?: string, onClick?: any; }> = ({ children, className, onClick }) => {
    return (
        <p onClick={onClick} className={classnames("inline-block rounded-full px-2 mr-2 text-sm", className, onClick && 'cursor-pointer')}>{children}</p>
    );
}

export default Pill;
